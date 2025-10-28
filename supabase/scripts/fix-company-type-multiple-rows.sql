-- Fix company_type table to have one row per company
-- 1. Delete all existing rows (including the problematic NULL one)
DELETE FROM company_type;

-- 2. Get company IDs and create proper records
DO $$
DECLARE
    assiny_id UUID;
    maniafoods_id UUID;
BEGIN
    -- Get Assiny company ID
    SELECT id INTO assiny_id
    FROM public.companies
    WHERE subdomain = 'assiny'
    LIMIT 1;

    -- Get Mania Foods company ID
    SELECT id INTO maniafoods_id
    FROM public.companies
    WHERE subdomain = 'maniafoods'
    LIMIT 1;

    -- Check if we found the companies
    IF assiny_id IS NULL THEN
        RAISE NOTICE 'Assiny company not found';
    ELSE
        -- Insert B2B type for Assiny
        INSERT INTO public.company_type (name, company_id, created_at, updated_at)
        VALUES ('B2B', assiny_id, NOW(), NOW());
        RAISE NOTICE 'Created B2B type for Assiny with company_id: %', assiny_id;
    END IF;

    IF maniafoods_id IS NULL THEN
        RAISE NOTICE 'Mania Foods company not found';
    ELSE
        -- Insert B2C type for Mania Foods
        INSERT INTO public.company_type (name, company_id, created_at, updated_at)
        VALUES ('B2C', maniafoods_id, NOW(), NOW());
        RAISE NOTICE 'Created B2C type for Mania Foods with company_id: %', maniafoods_id;
    END IF;
END $$;

-- 3. Verify the results
SELECT
    ct.id,
    ct.name as type,
    ct.company_id,
    c.name as company_name,
    c.subdomain
FROM company_type ct
LEFT JOIN companies c ON c.id = ct.company_id
ORDER BY ct.created_at;