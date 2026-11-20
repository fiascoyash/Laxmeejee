DROP POLICY IF EXISTS "Product photos of published shops are viewable" ON storage.objects;
CREATE POLICY "Visitors view photos of published shops" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'product-photos' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(objects.name))[1] AND b.is_published));
CREATE POLICY "Members and visitors view product photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-photos' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(objects.name))[1] AND (b.is_published OR public.is_business_member(b.id))));