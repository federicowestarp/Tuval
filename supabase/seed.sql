-- Datos de DEMOSTRACIÓN para desarrollo local. Sin precios: se cargan con la lista de Emmsa.
insert into productos (sku, nombre, categoria_id, atributos, unidad) values
  ('DEMO-0001', 'Cople PVC hidráulico', 'conexiones', '{"Medida":"1/2\"","Material":"PVC"}', 'pieza'),
  ('DEMO-0002', 'Válvula de esfera', 'valvulas', '{"Medida":"3/4\""}', 'pieza'),
  ('DEMO-0003', 'Tubería PPR', 'tuberia', '{"Medida":"1\"","Tramo":"4 m","Material":"PPR"}', 'tramo'),
  ('DEMO-0004', 'Codo 90° PVC hidráulico', 'conexiones', '{"Medida":"1/2\"","Material":"PVC"}', 'pieza'),
  ('DEMO-0005', 'Bomba periférica', 'equipos', '{"Voltaje":"127 V"}', 'pieza'),
  ('DEMO-0006', 'Cable THW', 'electrico', '{}', 'metro'),
  ('DEMO-0007', 'Cinta para rosca', 'herramienta', '{"Uso":"Agua fría y caliente"}', 'pieza'),
  ('DEMO-0008', 'Tubo conduit', 'electrico', '{"Medida":"1/2\""}', 'tramo');
