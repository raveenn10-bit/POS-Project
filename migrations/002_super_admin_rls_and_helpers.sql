-- Harsh Apex POS: Supabase Super Admin RLS Policies, Device Replacement, and Dashboard Functions
-- Applied to Supabase Project: meiiweucccymseqewouk

-- 1. Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pos_super_admins WHERE user_id = uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;

-- 2. Auto-promote chamilka.ch@gmail.com to pos_super_admins upon signup/creation
CREATE OR REPLACE FUNCTION public.handle_super_admin_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'chamilka.ch@gmail.com' THEN
    INSERT INTO public.pos_super_admins (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_super_admin'
  ) THEN
    CREATE TRIGGER on_auth_user_created_super_admin
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_super_admin_signup();
  END IF;
END;
$$;

-- 3. Grants to authenticated users (access filtered by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.pos_customers,
  public.pos_licenses,
  public.pos_license_devices,
  public.pos_activation_events,
  public.pos_admin_audit_logs,
  public.pos_subscription_payments
TO authenticated;

GRANT SELECT ON public.pos_super_admins TO authenticated;

-- 4. Row Level Security Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_customers_all' AND tablename = 'pos_customers') THEN
    CREATE POLICY super_admin_customers_all ON public.pos_customers
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_licenses_all' AND tablename = 'pos_licenses') THEN
    CREATE POLICY super_admin_licenses_all ON public.pos_licenses
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_devices_all' AND tablename = 'pos_license_devices') THEN
    CREATE POLICY super_admin_devices_all ON public.pos_license_devices
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_events_all' AND tablename = 'pos_activation_events') THEN
    CREATE POLICY super_admin_events_all ON public.pos_activation_events
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_audit_all' AND tablename = 'pos_admin_audit_logs') THEN
    CREATE POLICY super_admin_audit_all ON public.pos_admin_audit_logs
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_payments_all' AND tablename = 'pos_subscription_payments') THEN
    CREATE POLICY super_admin_payments_all ON public.pos_subscription_payments
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_read_self' AND tablename = 'pos_super_admins') THEN
    CREATE POLICY super_admin_read_self ON public.pos_super_admins
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- 5. Atomic Device Replacement Function
CREATE OR REPLACE FUNCTION public.pos_replace_device(
  p_license_id uuid,
  p_old_device_id uuid,
  p_new_device_hash text,
  p_new_device_name text DEFAULT 'Replacement Device',
  p_platform text DEFAULT 'web',
  p_reason text DEFAULT 'Device replacement',
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_device record;
  v_new_device_id uuid;
  v_license record;
BEGIN
  -- Lock license and check status
  SELECT * INTO v_license FROM public.pos_licenses WHERE id = p_license_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'License not found';
  END IF;
  IF v_license.status <> 'active' THEN
    RAISE EXCEPTION 'Cannot replace device on a non-active license';
  END IF;
  IF v_license.expires_at <= now() THEN
    RAISE EXCEPTION 'Cannot replace device on an expired license';
  END IF;

  -- Lock old device
  SELECT * INTO v_old_device FROM public.pos_license_devices
  WHERE id = p_old_device_id AND license_id = p_license_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active device to replace was not found under this license';
  END IF;

  -- Check if new device hash is already active on this or another license
  IF EXISTS (SELECT 1 FROM public.pos_license_devices WHERE device_identifier_hash = p_new_device_hash AND status = 'active') THEN
    RAISE EXCEPTION 'New device is already actively registered';
  END IF;

  -- Mark old device as replaced first to release the slot
  UPDATE public.pos_license_devices
  SET status = 'replaced',
      revoked_at = now()
  WHERE id = p_old_device_id;

  -- Insert new device
  INSERT INTO public.pos_license_devices (
    license_id,
    device_identifier_hash,
    device_name,
    platform,
    status,
    first_activated_at
  )
  VALUES (
    p_license_id,
    p_new_device_hash,
    p_new_device_name,
    p_platform,
    'active',
    now()
  )
  RETURNING id INTO v_new_device_id;

  -- Link replaced_by
  UPDATE public.pos_license_devices
  SET replaced_by = v_new_device_id
  WHERE id = p_old_device_id;

  -- Audit log & Activation event
  INSERT INTO public.pos_activation_events (license_id, device_id, event_type, event_details)
  VALUES (
    p_license_id,
    v_new_device_id,
    'device_replaced',
    jsonb_build_object(
      'old_device_id', p_old_device_id,
      'reason', p_reason,
      'admin_id', p_admin_id
    )
  );

  INSERT INTO public.pos_admin_audit_logs (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    p_admin_id,
    'replace_device',
    'pos_license_devices',
    v_new_device_id,
    jsonb_build_object(
      'license_id', p_license_id,
      'old_device_id', p_old_device_id,
      'new_device_id', v_new_device_id,
      'reason', p_reason
    )
  );

  RETURN v_new_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_replace_device TO authenticated;

-- 6. RPC function for live dashboard statistics
CREATE OR REPLACE FUNCTION public.pos_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin role required';
  END IF;

  SELECT jsonb_build_object(
    'total_customers', (SELECT count(*) FROM public.pos_customers WHERE status = 'active'),
    'active_licenses', (SELECT count(*) FROM public.pos_licenses WHERE status = 'active' AND expires_at > now()),
    'trial_licenses', (SELECT count(*) FROM public.pos_licenses WHERE plan = 'trial' AND status = 'active' AND expires_at > now()),
    'expired_licenses', (SELECT count(*) FROM public.pos_licenses WHERE expires_at <= now() OR status = 'expired'),
    'suspended_licenses', (SELECT count(*) FROM public.pos_licenses WHERE status = 'suspended'),
    'revoked_licenses', (SELECT count(*) FROM public.pos_licenses WHERE status = 'revoked'),
    'total_devices', (SELECT count(*) FROM public.pos_license_devices),
    'active_device_slots', (SELECT count(*) FROM public.pos_license_devices WHERE status = 'active'),
    'expiring_soon', (SELECT count(*) FROM public.pos_licenses WHERE status = 'active' AND expires_at > now() AND expires_at <= now() + interval '3 days'),
    'monthly_revenue', COALESCE((SELECT sum(amount_lkr) FROM public.pos_subscription_payments WHERE status = 'paid' AND created_at >= date_trunc('month', now())), 0),
    'pending_payments', (SELECT count(*) FROM public.pos_subscription_payments WHERE status = 'pending'),
    'recent_activations', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT e.id, e.event_type, e.occurred_at, e.license_id, c.business_name, d.device_name
        FROM public.pos_activation_events e
        LEFT JOIN public.pos_licenses l ON e.license_id = l.id
        LEFT JOIN public.pos_customers c ON l.customer_id = c.id
        LEFT JOIN public.pos_license_devices d ON e.device_id = d.id
        ORDER BY e.occurred_at DESC
        LIMIT 5
      ) sub
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_get_dashboard_stats TO authenticated;
