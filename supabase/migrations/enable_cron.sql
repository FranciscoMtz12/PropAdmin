-- Habilitar extensión pg_cron
-- Requiere activarla primero en Dashboard → Database → Extensions → pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para hacer HTTP desde cron (necesario para llamar Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Programar cron el día 1 de cada mes a las 6am UTC
-- Llama a la Edge Function generate-monthly-charges con el CRON_SECRET como Bearer token
SELECT cron.schedule(
  'generate-monthly-charges',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/generate-monthly-charges',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para verificar que el cron quedó registrado:
-- SELECT * FROM cron.job;

-- Para eliminarlo si necesitas cambiar la configuración:
-- SELECT cron.unschedule('generate-monthly-charges');
