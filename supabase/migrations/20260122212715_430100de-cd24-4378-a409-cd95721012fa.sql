UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]
WHERE id = 'economic-imports';