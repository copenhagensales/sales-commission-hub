-- Fix overly permissive RLS policies that expose data to all authenticated users
-- These tables should only be accessible to managers/admins

-- 1. Fix sales table - restrict to managers only (contains customer PII)
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
CREATE POLICY "Managers can view sales" ON sales
FOR SELECT USING (is_manager_or_above(auth.uid()));

-- 2. Fix employee_identity table - restrict to managers only
DROP POLICY IF EXISTS "Authenticated users can view employee_identity" ON employee_identity;
CREATE POLICY "Only managers can view employee_identity" ON employee_identity
FOR SELECT USING (is_manager_or_above(auth.uid()));

-- 3. Fix master_employee table - restrict to managers only
DROP POLICY IF EXISTS "Authenticated users can view master_employee" ON master_employee;
CREATE POLICY "Only managers can view master_employee" ON master_employee
FOR SELECT USING (is_manager_or_above(auth.uid()));

-- 4. Fix adversus_events table - restrict to managers only
DROP POLICY IF EXISTS "Authenticated users can view adversus_events" ON adversus_events;
CREATE POLICY "Only managers can view adversus_events" ON adversus_events
FOR SELECT USING (is_manager_or_above(auth.uid()));

-- 5. Fix sale_items table - restrict to managers only (contains pricing info)
DROP POLICY IF EXISTS "Authenticated users can view sale_items" ON sale_items;
CREATE POLICY "Only managers can view sale_items" ON sale_items
FOR SELECT USING (is_manager_or_above(auth.uid()));

-- 6. Fix products table - restrict to managers only (contains pricing/commission info)
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
CREATE POLICY "Only managers can view products" ON products
FOR SELECT USING (is_manager_or_above(auth.uid()));