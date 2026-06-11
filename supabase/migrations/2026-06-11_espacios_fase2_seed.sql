-- ============================================================
-- FASE 2: Seed Inmobiliaria Demo — todos los casos del modelo
-- ============================================================
-- Solo INSERTs. Crea empresa "Inmobiliaria Demo" + 8 casos.
-- NO toca el modelo viejo ni otras empresas.
-- NOTA: assets omitidos — la tabla assets aún tiene building_id/unit_id
-- NOT NULL del modelo viejo. Se añadirán cuando se modifique esa tabla.

DO $$
DECLARE
  -- empresa
  v_co uuid;

  -- tenants (19)
  v_t_ana       uuid; v_t_carlos    uuid; v_t_diana    uuid;
  v_t_edu       uuid; v_t_fer       uuid; v_t_gabriel  uuid; v_t_hilda    uuid;
  v_t_industrial uuid; v_t_logistica uuid;
  v_t_bod_a     uuid; v_t_frio      uuid; v_t_almacen  uuid;
  v_t_abarro    uuid; v_t_salon     uuid; v_t_mayoreo  uuid;
  v_t_corp      uuid; v_t_diseno    uuid; v_t_startup  uuid; v_t_tech     uuid;

  -- properties (7)
  v_p_roble     uuid; v_p_encino    uuid; v_p_cedro    uuid;
  v_p_cruces    uuid; v_p_fresno    uuid; v_p_sauce    uuid;
  v_p_ahuehuete uuid;

  -- space_groups
  v_sg_c1 uuid; v_sg_c2 uuid; v_sg_c3 uuid; v_sg_c4 uuid;  -- Las Cruces naves
  v_sg_s1 uuid; v_sg_s2 uuid; v_sg_s3 uuid; v_sg_s4 uuid;  -- Torre Sauce pisos

  -- template
  v_tmpl uuid;

  -- spaces
  v_s_roble   uuid;                                                       -- Casa Roble
  v_s_encino  uuid;                                                       -- Casa Encino
  v_s_c101    uuid; v_s_c102    uuid; v_s_c201    uuid;                   -- Cedro pisos
  v_s_c202    uuid; v_s_c301    uuid; v_s_c302    uuid;
  v_s_terraza uuid;
  v_s_cn1     uuid; v_s_cn2     uuid; v_s_cn3     uuid;                   -- Las Cruces
  v_s_cn4a    uuid; v_s_cn4b    uuid; v_s_cn4c    uuid;
  v_s_fl1     uuid; v_s_fl2     uuid; v_s_fl3     uuid;                   -- Plaza Fresno
  v_s_fbod    uuid; v_s_fpa     uuid; v_s_fpb     uuid;
  v_s_sp1     uuid; v_s_sp2     uuid; v_s_sp3     uuid; v_s_sp4 uuid;    -- Torre Sauce
  v_s_terreno uuid;                                                       -- Terreno

  -- space_subdivisions
  v_sd_enc1 uuid; v_sd_enc2 uuid; v_sd_enc3 uuid;   -- Encino recámaras
  v_sd_102a uuid; v_sd_102b uuid;                    -- Cedro 102 recámaras
  v_sd_s2a  uuid; v_sd_s2b  uuid;                    -- Sauce Piso 2 metraje
  v_sd_s4a  uuid; v_sd_s4b  uuid; v_sd_s4c  uuid;   -- Sauce Piso 4 metraje

  -- leases (18)
  v_l_roble  uuid;
  v_l_enc_a  uuid; v_l_enc_b  uuid;
  v_l_c101   uuid; v_l_c201   uuid; v_l_c301   uuid; v_l_c102 uuid;
  v_l_cr12   uuid; v_l_cr3    uuid;
  v_l_cr4a   uuid; v_l_cr4b   uuid; v_l_cr4c   uuid;
  v_l_fl1    uuid; v_l_fl2    uuid; v_l_fbod   uuid;
  v_l_sp1    uuid; v_l_sp2    uuid;
  v_l_sp4a   uuid; v_l_sp4b   uuid;

BEGIN

  -- ═══════════════════════════════════════════════════════════
  -- PASO 1: Empresa demo
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO companies (name, brand_color, short_name)
  VALUES ('Inmobiliaria Demo', '#0D9488', 'DEMO')
  RETURNING id INTO v_co;

  RAISE NOTICE 'company_id Inmobiliaria Demo: %', v_co;

  -- ═══════════════════════════════════════════════════════════
  -- PASO 2: Tenants demo (19)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Ana García',          'ACTIVE', true) RETURNING id INTO v_t_ana;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Carlos Ramírez',      'ACTIVE', true) RETURNING id INTO v_t_carlos;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Diana Morales',       'ACTIVE', true) RETURNING id INTO v_t_diana;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Eduardo Soto',        'ACTIVE', true) RETURNING id INTO v_t_edu;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Fernanda Ibarra',     'ACTIVE', true) RETURNING id INTO v_t_fer;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Gabriel Reyes',       'ACTIVE', true) RETURNING id INTO v_t_gabriel;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Hilda Castro',        'ACTIVE', true) RETURNING id INTO v_t_hilda;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Industrial Norte SA', 'ACTIVE', true) RETURNING id INTO v_t_industrial;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Logística Sur SA',    'ACTIVE', true) RETURNING id INTO v_t_logistica;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Bodegas Express',     'ACTIVE', true) RETURNING id INTO v_t_bod_a;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Frío del Norte',      'ACTIVE', true) RETURNING id INTO v_t_frio;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Almacén Central',     'ACTIVE', true) RETURNING id INTO v_t_almacen;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Abarrotes González',  'ACTIVE', true) RETURNING id INTO v_t_abarro;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Salón Luna',          'ACTIVE', true) RETURNING id INTO v_t_salon;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Mayoreo Fresno SA',   'ACTIVE', true) RETURNING id INTO v_t_mayoreo;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Corp Offices SA',     'ACTIVE', true) RETURNING id INTO v_t_corp;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Diseño MX',           'ACTIVE', true) RETURNING id INTO v_t_diseno;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Startup Ideas',       'ACTIVE', true) RETURNING id INTO v_t_startup;

  INSERT INTO tenants (company_id, full_name, status, is_test)
  VALUES (v_co, 'Tech Creativo',       'ACTIVE', true) RETURNING id INTO v_t_tech;


  -- ═══════════════════════════════════════════════════════════
  -- CASO 1: Casa Roble — unifamiliar rentada completa
  -- Resultado esperado: status RENTED (contrato whole activo)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, total_sqm, is_test)
  VALUES (v_co, 'Casa Roble', 'Residencial unifamiliar',
          'Av. Roble 123, Col. Arbórea', 185, true)
  RETURNING id INTO v_p_roble;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_roble, 'house', 'both', true, 'CASA-1', 185, 3, 2, true)
  RETURNING id INTO v_s_roble;

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_ana, 12000, 'ACTIVE', '2025-01-01', true)
  RETURNING id INTO v_l_roble;

  -- lease_space: contrato completo → trigger sync → RENTED
  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_roble, v_s_roble, 12000);

  INSERT INTO space_rent_history
    (company_id, space_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES (v_co, v_s_roble, v_l_roble, 12000, 'whole', '2025-01-01');

  UPDATE spaces SET reference_rent_whole = 12000 WHERE id = v_s_roble;


  -- ═══════════════════════════════════════════════════════════
  -- CASO 2: Casa Encino — rentada por cuartos (3 cuartos, 2 contratos)
  -- Resultado esperado: status RENTED (3/3 subdivisiones activas)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, total_sqm, is_test)
  VALUES (v_co, 'Casa Encino', 'Residencial unifamiliar',
          'Calle Encino 47, Col. Arboleda', 220, true)
  RETURNING id INTO v_p_encino;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_encino, 'house', 'by_subdivision', true, 'CASA-1', 220, 3, 2, true)
  RETURNING id INTO v_s_encino;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sort_order, is_active)
  VALUES (v_co, v_s_encino, 'room', 'Recámara 1', 1, true) RETURNING id INTO v_sd_enc1;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sort_order, is_active)
  VALUES (v_co, v_s_encino, 'room', 'Recámara 2', 2, true) RETURNING id INTO v_sd_enc2;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sort_order, is_active)
  VALUES (v_co, v_s_encino, 'room', 'Recámara 3', 3, true) RETURNING id INTO v_sd_enc3;

  -- Lease A: Carlos → Recámara 1 + 2 (mismo contrato, multi-subdivisión)
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_carlos, 9000, 'ACTIVE', '2025-02-01', true)
  RETURNING id INTO v_l_enc_a;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_rent)
  VALUES (v_l_enc_a, v_s_encino, v_sd_enc1, 4500);  -- trigger → PARTIAL

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_rent)
  VALUES (v_l_enc_a, v_s_encino, v_sd_enc2, 4500);  -- trigger → PARTIAL (2/3)

  -- Lease B: Diana → Recámara 3
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_diana, 4500, 'ACTIVE', '2025-03-01', true)
  RETURNING id INTO v_l_enc_b;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_rent)
  VALUES (v_l_enc_b, v_s_encino, v_sd_enc3, 4500);  -- trigger → RENTED (3/3)

  INSERT INTO space_rent_history
    (company_id, space_id, space_subdivision_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_encino, v_sd_enc1, v_l_enc_a, 4500, 'subdivided', '2025-02-01'),
    (v_co, v_s_encino, v_sd_enc2, v_l_enc_a, 4500, 'subdivided', '2025-02-01'),
    (v_co, v_s_encino, v_sd_enc3, v_l_enc_b, 4500, 'subdivided', '2025-03-01');

  -- 3 cuartos a capacidad = 13500
  UPDATE spaces SET reference_rent_subdivided = 13500 WHERE id = v_s_encino;


  -- ═══════════════════════════════════════════════════════════
  -- CASO 3: Edificio Cedro — multifamiliar, estados variados
  -- 3 deptos RENTED, 2 VACANT, 1 PARTIAL (1 de 2 cuartos rentado)
  -- Terraza amenity is_rentable=false
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, is_test)
  VALUES (v_co, 'Edificio Cedro', 'Residencial multifamiliar',
          'Blvd. Cedro 200, Col. Norte', true)
  RETURNING id INTO v_p_cedro;

  -- Template
  INSERT INTO space_templates
    (company_id, property_id, space_type, name, bedrooms, bathrooms,
     has_living_room, has_dining_room, has_washer, has_fridge)
  VALUES (v_co, v_p_cedro, 'apartment', 'Depto 2 recámaras tipo A',
          2, 1, true, true, true, true)
  RETURNING id INTO v_tmpl;

  INSERT INTO space_template_assets (space_template_id, asset_type, name, sort_order)
  VALUES
    (v_tmpl, 'electrodomestico', 'Refrigerador',        1),
    (v_tmpl, 'electrodomestico', 'Lavadora',             2),
    (v_tmpl, 'calefaccion',      'Calentador de agua',   3);

  -- Piso 1
  INSERT INTO spaces (company_id, property_id, space_template_id, space_type,
                      rental_mode, is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, v_tmpl, 'apartment', 'whole', true, '101', '1', 75, 2, 1, true)
  RETURNING id INTO v_s_c101;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, 'apartment', 'both', true, '102', '1', 75, 2, 1, true)
  RETURNING id INTO v_s_c102;

  -- Piso 2
  INSERT INTO spaces (company_id, property_id, space_template_id, space_type,
                      rental_mode, is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, v_tmpl, 'apartment', 'whole', true, '201', '2', 75, 2, 1, true)
  RETURNING id INTO v_s_c201;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, 'apartment', 'whole', true, '202', '2', 75, 2, 1, true)
  RETURNING id INTO v_s_c202;

  -- Piso 3
  INSERT INTO spaces (company_id, property_id, space_template_id, space_type,
                      rental_mode, is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, v_tmpl, 'apartment', 'whole', true, '301', '3', 75, 2, 1, true)
  RETURNING id INTO v_s_c301;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, floor, total_sqm, bedrooms, bathrooms, is_test)
  VALUES (v_co, v_p_cedro, 'apartment', 'whole', true, '302', '3', 75, 2, 1, true)
  RETURNING id INTO v_s_c302;

  -- Amenidad (CASO 8 incluido aquí)
  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, is_test)
  VALUES (v_co, v_p_cedro, 'amenity', 'whole', false, 'TERRAZA', true)
  RETURNING id INTO v_s_terraza;

  -- Subdivisiones de Depto 102 (2 recámaras, ambas activas)
  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sort_order, is_active)
  VALUES (v_co, v_s_c102, 'room', 'Recámara 1', 1, true) RETURNING id INTO v_sd_102a;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sort_order, is_active)
  VALUES (v_co, v_s_c102, 'room', 'Recámara 2', 2, true) RETURNING id INTO v_sd_102b;

  -- Leases para 101, 201, 301 (renta completa)
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_edu, 9500, 'ACTIVE', '2025-01-15', true) RETURNING id INTO v_l_c101;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_c101, v_s_c101, 9500);  -- trigger → 101 RENTED

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_fer, 9500, 'ACTIVE', '2025-02-01', true) RETURNING id INTO v_l_c201;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_c201, v_s_c201, 9500);  -- trigger → 201 RENTED

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_gabriel, 9500, 'ACTIVE', '2025-03-01', true) RETURNING id INTO v_l_c301;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_c301, v_s_c301, 9500);  -- trigger → 301 RENTED

  -- Lease 102: Hilda renta solo Recámara 1 → 102 PARTIAL
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_hilda, 5000, 'ACTIVE', '2025-04-01', true) RETURNING id INTO v_l_c102;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_rent)
  VALUES (v_l_c102, v_s_c102, v_sd_102a, 5000);  -- trigger → sub_count=1, total=2 → PARTIAL

  -- 202, 302 quedan VACANT (sin lease_space)

  INSERT INTO space_rent_history
    (company_id, space_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_c101, v_l_c101, 9500, 'whole', '2025-01-15'),
    (v_co, v_s_c201, v_l_c201, 9500, 'whole', '2025-02-01'),
    (v_co, v_s_c301, v_l_c301, 9500, 'whole', '2025-03-01');

  INSERT INTO space_rent_history
    (company_id, space_id, space_subdivision_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_c102, v_sd_102a, v_l_c102, 5000, 'subdivided', '2025-04-01');

  UPDATE spaces SET reference_rent_whole       = 9500  WHERE id IN (v_s_c101, v_s_c201, v_s_c301);
  UPDATE spaces SET reference_rent_subdivided  = 10000 WHERE id = v_s_c102; -- 2 rec × $5000


  -- ═══════════════════════════════════════════════════════════
  -- CASO 4: Parque Las Cruces — industrial, 4 naves, multi-espacio
  -- Nave1+2: 1 contrato multi-espacio. Nave3: 1 contrato.
  -- Nave4: 3 bodegas de distinto sqm, 3 contratos.
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, total_sqm, is_test)
  VALUES (v_co, 'Parque Las Cruces', 'Industrial · Parque',
          'Carr. Las Cruces Km 12', 15000, true)
  RETURNING id INTO v_p_cruces;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_cruces, 'Nave 1', 'nave', 1) RETURNING id INTO v_sg_c1;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_cruces, 'Nave 2', 'nave', 2) RETURNING id INTO v_sg_c2;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_cruces, 'Nave 3', 'nave', 3) RETURNING id INTO v_sg_c3;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_cruces, 'Nave 4', 'nave', 4) RETURNING id INTO v_sg_c4;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c1, 'warehouse', 'whole', true, 'N1-BOD',  800, 8.5, 'dock',  true)
  RETURNING id INTO v_s_cn1;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c2, 'warehouse', 'whole', true, 'N2-BOD', 1200, 8.5, 'dock',  true)
  RETURNING id INTO v_s_cn2;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c3, 'warehouse', 'whole', true, 'N3-BOD',  500, 6.0, 'nivel', true)
  RETURNING id INTO v_s_cn3;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c4, 'warehouse', 'whole', true, 'N4-BODA', 350, 6.0, 'nivel', true)
  RETURNING id INTO v_s_cn4a;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c4, 'warehouse', 'whole', true, 'N4-BODB', 250, 6.0, 'nivel', true)
  RETURNING id INTO v_s_cn4b;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_cruces, v_sg_c4, 'warehouse', 'whole', true, 'N4-BODC', 450, 7.0, 'rampa', true)
  RETURNING id INTO v_s_cn4c;

  -- Contrato multi-espacio: Industrial Norte cubre Nave 1 + Nave 2
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_industrial, 55000, 'ACTIVE', '2025-01-01', true)
  RETURNING id INTO v_l_cr12;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr12, v_s_cn1, 20000);  -- trigger → cn1 RENTED

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr12, v_s_cn2, 35000);  -- trigger → cn2 RENTED

  -- Nave 3
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_logistica, 18000, 'ACTIVE', '2025-01-01', true)
  RETURNING id INTO v_l_cr3;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr3, v_s_cn3, 18000);   -- trigger → cn3 RENTED

  -- Nave 4: 3 contratos independientes
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_bod_a, 12000, 'ACTIVE', '2025-03-01', true) RETURNING id INTO v_l_cr4a;
  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr4a, v_s_cn4a, 12000);

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_frio, 9000, 'ACTIVE', '2025-03-01', true) RETURNING id INTO v_l_cr4b;
  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr4b, v_s_cn4b, 9000);

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_almacen, 15000, 'ACTIVE', '2025-04-01', true) RETURNING id INTO v_l_cr4c;
  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_cr4c, v_s_cn4c, 15000);

  INSERT INTO space_rent_history
    (company_id, space_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_cn1,  v_l_cr12, 20000, 'whole', '2025-01-01'),
    (v_co, v_s_cn2,  v_l_cr12, 35000, 'whole', '2025-01-01'),
    (v_co, v_s_cn3,  v_l_cr3,  18000, 'whole', '2025-01-01'),
    (v_co, v_s_cn4a, v_l_cr4a, 12000, 'whole', '2025-03-01'),
    (v_co, v_s_cn4b, v_l_cr4b,  9000, 'whole', '2025-03-01'),
    (v_co, v_s_cn4c, v_l_cr4c, 15000, 'whole', '2025-04-01');

  UPDATE spaces SET reference_rent_whole = 20000 WHERE id = v_s_cn1;
  UPDATE spaces SET reference_rent_whole = 35000 WHERE id = v_s_cn2;
  UPDATE spaces SET reference_rent_whole = 18000 WHERE id = v_s_cn3;
  UPDATE spaces SET reference_rent_whole = 12000 WHERE id = v_s_cn4a;
  UPDATE spaces SET reference_rent_whole =  9000 WHERE id = v_s_cn4b;
  UPDATE spaces SET reference_rent_whole = 15000 WHERE id = v_s_cn4c;


  -- ═══════════════════════════════════════════════════════════
  -- CASO 5: Plaza Fresno — mixto comercial + industrial
  -- Local 2: parking incluido (billing_mode='included', allocated_rent=0)
  -- Bodega: parking cobrado aparte (billing_mode='separate', allocated_rent=2000)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, is_test)
  VALUES (v_co, 'Plaza Fresno', 'Mixto · Comercial + Industrial',
          'Blvd. Fresno 450', true)
  RETURNING id INTO v_p_fresno;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, is_test)
  VALUES (v_co, v_p_fresno, 'commercial_local', 'whole', true, 'LOCAL-1', 80, true)
  RETURNING id INTO v_s_fl1;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, is_test)
  VALUES (v_co, v_p_fresno, 'commercial_local', 'whole', true, 'LOCAL-2', 95, true)
  RETURNING id INTO v_s_fl2;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, is_test)
  VALUES (v_co, v_p_fresno, 'commercial_local', 'whole', true, 'LOCAL-3', 90, true)
  RETURNING id INTO v_s_fl3;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, altura_libre, acceso_tipo, is_test)
  VALUES (v_co, v_p_fresno, 'warehouse', 'whole', true, 'BOD-1', 600, 6.0, 'rampa', true)
  RETURNING id INTO v_s_fbod;

  -- Parking A: irá incluido en el lease del Local 2
  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, is_test)
  VALUES (v_co, v_p_fresno, 'parking', 'whole', true, 'PARK-A', true)
  RETURNING id INTO v_s_fpa;

  -- Parking B: cobrado aparte en el lease de la bodega
  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, is_test)
  VALUES (v_co, v_p_fresno, 'parking', 'whole', true, 'PARK-B', true)
  RETURNING id INTO v_s_fpb;

  -- Local 1: Abarrotes González
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_abarro, 14000, 'ACTIVE', '2025-01-15', true) RETURNING id INTO v_l_fl1;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_fl1, v_s_fl1, 14000);  -- fl1 → RENTED

  -- Local 2 + Parking A incluido: Salón Luna
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_salon, 16000, 'ACTIVE', '2025-02-01', true) RETURNING id INTO v_l_fl2;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_fl2, v_s_fl2, 16000);  -- fl2 → RENTED

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent, billing_mode)
  VALUES (v_l_fl2, v_s_fpa, 0, 'included');  -- fpa → RENTED (renta 0 incluida)

  -- Bodega + Parking B cobrado aparte: Mayoreo Fresno
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_mayoreo, 28000, 'ACTIVE', '2025-01-01', true) RETURNING id INTO v_l_fbod;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent)
  VALUES (v_l_fbod, v_s_fbod, 26000);  -- fbod → RENTED

  INSERT INTO lease_spaces (lease_id, space_id, allocated_rent, billing_mode)
  VALUES (v_l_fbod, v_s_fpb, 2000, 'separate');  -- fpb → RENTED (cargo independiente)

  -- Local 3 queda VACANT (sin lease)

  INSERT INTO space_rent_history
    (company_id, space_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_fl1,  v_l_fl1,   14000, 'whole', '2025-01-15'),
    (v_co, v_s_fl2,  v_l_fl2,   16000, 'whole', '2025-02-01'),
    (v_co, v_s_fbod, v_l_fbod,  26000, 'whole', '2025-01-01'),
    (v_co, v_s_fpa,  v_l_fl2,       0, 'whole', '2025-02-01'),
    (v_co, v_s_fpb,  v_l_fbod,   2000, 'whole', '2025-01-01');

  UPDATE spaces SET reference_rent_whole = 14000 WHERE id = v_s_fl1;
  UPDATE spaces SET reference_rent_whole = 16000 WHERE id = v_s_fl2;
  UPDATE spaces SET reference_rent_whole = 26000 WHERE id = v_s_fbod;


  -- ═══════════════════════════════════════════════════════════
  -- CASO 6: Torre Sauce — oficinas divisibles por metraje
  -- Piso 1: RENTED whole (600m²)
  -- Piso 2: PARTIAL (300/600m²)
  -- Piso 3: VACANT
  -- Piso 4: PARTIAL (400/600m², 2 de 3 módulos rentados)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, total_sqm, is_test)
  VALUES (v_co, 'Torre Sauce', 'Comercial · Oficinas',
          'Av. Sauce 1000 Torre B', 2400, true)
  RETURNING id INTO v_p_sauce;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_sauce, 'Piso 1', 'piso', 1) RETURNING id INTO v_sg_s1;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_sauce, 'Piso 2', 'piso', 2) RETURNING id INTO v_sg_s2;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_sauce, 'Piso 3', 'piso', 3) RETURNING id INTO v_sg_s3;

  INSERT INTO space_groups (company_id, property_id, name, group_type, sort_order)
  VALUES (v_co, v_p_sauce, 'Piso 4', 'piso', 4) RETURNING id INTO v_sg_s4;

  -- 1 office divisible por piso, total_sqm=600, min 100m²
  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm,
                      is_divisible, divisible_strategy, min_division_sqm, is_test)
  VALUES (v_co, v_p_sauce, v_sg_s1, 'office', 'both', true, 'P1-OF',
          600, true, 'free_metraje', 100, true)
  RETURNING id INTO v_s_sp1;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm,
                      is_divisible, divisible_strategy, min_division_sqm, is_test)
  VALUES (v_co, v_p_sauce, v_sg_s2, 'office', 'both', true, 'P2-OF',
          600, true, 'free_metraje', 100, true)
  RETURNING id INTO v_s_sp2;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm,
                      is_divisible, divisible_strategy, min_division_sqm, is_test)
  VALUES (v_co, v_p_sauce, v_sg_s3, 'office', 'both', true, 'P3-OF',
          600, true, 'free_metraje', 100, true)
  RETURNING id INTO v_s_sp3;

  INSERT INTO spaces (company_id, property_id, space_group_id, space_type,
                      rental_mode, is_rentable, code, total_sqm,
                      is_divisible, divisible_strategy, min_division_sqm, is_test)
  VALUES (v_co, v_p_sauce, v_sg_s4, 'office', 'both', true, 'P4-OF',
          600, true, 'free_metraje', 100, true)
  RETURNING id INTO v_s_sp4;

  -- Subdivisiones Piso 2: 2 módulos × 300m²
  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sqm, sort_order, is_active)
  VALUES (v_co, v_s_sp2, 'metraje', 'Módulo Norte', 300, 1, true)
  RETURNING id INTO v_sd_s2a;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sqm, sort_order, is_active)
  VALUES (v_co, v_s_sp2, 'metraje', 'Módulo Sur', 300, 2, true)
  RETURNING id INTO v_sd_s2b;

  -- Subdivisiones Piso 4: 3 módulos × 200m²
  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sqm, sort_order, is_active)
  VALUES (v_co, v_s_sp4, 'metraje', 'Módulo A', 200, 1, true)
  RETURNING id INTO v_sd_s4a;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sqm, sort_order, is_active)
  VALUES (v_co, v_s_sp4, 'metraje', 'Módulo B', 200, 2, true)
  RETURNING id INTO v_sd_s4b;

  INSERT INTO space_subdivisions
    (company_id, space_id, subdivision_type, label, sqm, sort_order, is_active)
  VALUES (v_co, v_s_sp4, 'metraje', 'Módulo C', 200, 3, true)
  RETURNING id INTO v_sd_s4c;

  -- Piso 1: rentado completo (sin subdivision, Corp Offices SA)
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_corp, 90000, 'ACTIVE', '2025-01-01', true) RETURNING id INTO v_l_sp1;

  INSERT INTO lease_spaces (lease_id, space_id, allocated_sqm, allocated_rent)
  VALUES (v_l_sp1, v_s_sp1, 600, 90000);  -- space_subdivision_id=NULL → v_whole_count=1 → RENTED

  -- Piso 2: 1 módulo rentado (Diseño MX, Módulo Norte 300m²)
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_diseno, 45000, 'ACTIVE', '2025-03-01', true) RETURNING id INTO v_l_sp2;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_sqm, allocated_rent)
  VALUES (v_l_sp2, v_s_sp2, v_sd_s2a, 300, 45000);  -- is_divisible, alloc=300 < 600 → PARTIAL

  -- Piso 3: VACANT (sin lease)

  -- Piso 4: 2 módulos rentados de 3 (Startup + Tech, 200+200m²)
  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_startup, 30000, 'ACTIVE', '2025-04-01', true) RETURNING id INTO v_l_sp4a;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_sqm, allocated_rent)
  VALUES (v_l_sp4a, v_s_sp4, v_sd_s4a, 200, 30000);  -- alloc=200 < 600 → PARTIAL

  INSERT INTO leases (company_id, tenant_id, rent_amount, status, start_date, is_test)
  VALUES (v_co, v_t_tech, 30000, 'ACTIVE', '2025-04-01', true) RETURNING id INTO v_l_sp4b;

  INSERT INTO lease_spaces (lease_id, space_id, space_subdivision_id, allocated_sqm, allocated_rent)
  VALUES (v_l_sp4b, v_s_sp4, v_sd_s4b, 200, 30000);  -- alloc=400 < 600 → PARTIAL

  INSERT INTO space_rent_history
    (company_id, space_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES (v_co, v_s_sp1, v_l_sp1, 90000, 'whole', '2025-01-01');

  INSERT INTO space_rent_history
    (company_id, space_id, space_subdivision_id, lease_id, rent_amount, rental_mode, effective_from)
  VALUES
    (v_co, v_s_sp2, v_sd_s2a, v_l_sp2,  45000, 'subdivided', '2025-03-01'),
    (v_co, v_s_sp4, v_sd_s4a, v_l_sp4a, 30000, 'subdivided', '2025-04-01'),
    (v_co, v_s_sp4, v_sd_s4b, v_l_sp4b, 30000, 'subdivided', '2025-04-01');

  UPDATE spaces SET reference_rent_whole       = 90000 WHERE id = v_s_sp1;
  UPDATE spaces SET reference_rent_subdivided  = 90000 WHERE id = v_s_sp2; -- 2 × 45000 a capacidad
  UPDATE spaces SET reference_rent_subdivided  = 90000 WHERE id = v_s_sp4; -- 3 × 30000 a capacidad


  -- ═══════════════════════════════════════════════════════════
  -- CASO 7: Terreno Ahuehuete — VACANT, sin contrato
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO properties (company_id, name, property_label, address, total_sqm, is_test)
  VALUES (v_co, 'Terreno Ahuehuete', 'Terreno', 'Carr. Ahuehuete S/N', 5000, true)
  RETURNING id INTO v_p_ahuehuete;

  INSERT INTO spaces (company_id, property_id, space_type, rental_mode,
                      is_rentable, code, total_sqm, is_test)
  VALUES (v_co, v_p_ahuehuete, 'land_lot', 'whole', true, 'LOT-1', 5000, true)
  RETURNING id INTO v_s_terreno;
  -- Sin lease_space → status permanece VACANT


  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED FASE 2 COMPLETO';
  RAISE NOTICE 'company_id Inmobiliaria Demo: %', v_co;
  RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Seed falló en: % — SQLSTATE: %', SQLERRM, SQLSTATE;
END;
$$;
