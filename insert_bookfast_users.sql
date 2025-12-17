-- Insertar usuarios demo BookFast en auth.users (local, sin Cloud)
INSERT INTO auth.users (
  id,
  email,
  aud,
  role,
  confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES
  ('99485222-83cb-4a3e-a736-09398185bb77',
   'josep@bookfast.es',
   'authenticated',
   'authenticated',
   NOW(),
   NOW(),
   NOW(),
   $$ {"provider":"email","providers":["email"]} $$::jsonb,
   $$ {"full_name":"Josep Calafat"} $$::jsonb
  ),
  ('caafefd8-894a-4fd1-be6d-40bb5cb7768b',
   'sergi@bookfast.es',
   'authenticated',
   'authenticated',
   NOW(),
   NOW(),
   NOW(),
   $$ {"provider":"email","providers":["email"]} $$::jsonb,
   $$ {"full_name":"Sergi"} $$::jsonb
  )
ON CONFLICT (id) DO NOTHING;
