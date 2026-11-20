ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT 'amber';
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "Product photos of published shops are viewable" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-photos' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND (b.is_published OR public.is_business_member(b.id))));
CREATE POLICY "Shop managers upload product photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-photos' AND public.is_business_member(((storage.foldername(name))[1])::uuid, ARRAY['owner'::business_role,'manager'::business_role]));
CREATE POLICY "Shop managers update product photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-photos' AND public.is_business_member(((storage.foldername(name))[1])::uuid, ARRAY['owner'::business_role,'manager'::business_role]));
CREATE POLICY "Shop managers delete product photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-photos' AND public.is_business_member(((storage.foldername(name))[1])::uuid, ARRAY['owner'::business_role,'manager'::business_role]));