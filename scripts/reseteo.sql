-- Usuario veterinario
-- Desactiva temporalmente las restricciones de clave foránea
SET session_replication_role = replica;

TRUNCATE TABLE 
  invoice_items,
  invoices,
  medical_records,
  appointments,
  order_items,
  client_orders,
  pets,
  owners,
  products,
  users,
  clinic_configuration
RESTART IDENTITY CASCADE;

-- Restaura la verificación de claves foráneas
SET session_replication_role = DEFAULT;




INSERT INTO users (id, email, password_hash, full_name, role, phone, specialty, status) VALUES
(gen_random_uuid(), 'admin@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. María González', 'admin', '555-0101', 'Administración', 'active'),
(gen_random_uuid(), 'vet@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Carlos Rodríguez', 'veterinarian', '555-0102', 'Medicina General', 'active'),
(gen_random_uuid(), 'reception@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ana Martínez', 'receptionist', '555-0103', NULL, 'active'),
(gen_random_uuid(), 'vet2@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Laura Fernández', 'veterinarian', '555-0104', 'Cirugía', 'active');

-- Dueño
INSERT INTO owners (id, first_name, last_name, email, phone, city, state, zip_code)
VALUES (
  gen_random_uuid(), 
  'Juan', 
  'Pérez', 
  'juan.perez@example.com', 
  '999999999', 
  'Lima', 
  'Lima', 
  '15001'
);

-- Mascota
INSERT INTO pets (id, owner_id, name, species, breed, gender)
SELECT 
  gen_random_uuid(),
  id,
  'Firulais',
  'Canino',
  'Labrador',
  'Macho'
FROM owners LIMIT 1;

-- Producto
INSERT INTO products (name, category, description, price, cost, stock_quantity, low_stock_threshold, supplier) VALUES
('Vacuna Antirrábica', 'medicamento', 'Vacuna contra la rabia para perros y gatos', 25.00, 15.00, 50, 10, 'MedVet Supply'),
('Desparasitante Interno', 'medicamento', 'Tratamiento contra parásitos internos', 18.50, 12.00, 30, 5, 'VetPharm'),
('Consulta General', 'servicio', 'Consulta veterinaria general', 45.00, 0.00, 999, 0, 'Servicio Interno'),
('Cirugía Menor', 'servicio', 'Procedimientos quirúrgicos menores', 150.00, 0.00, 999, 0, 'Servicio Interno'),
('Comida Premium Perro', 'alimento', 'Alimento balanceado premium para perros', 35.00, 25.00, 20, 5, 'Pet Food Co'),
('Juguete Interactivo', 'accesorios', 'Juguete para estimulación mental', 12.00, 8.00, 25, 3, 'Pet Toys Inc'),
('Collar Antipulgas', 'accesorios', 'Collar preventivo contra pulgas y garrapatas', 22.00, 16.00, 40, 8, 'Pest Control Supply'),
('Shampoo Medicinal', 'medicamento', 'Shampoo para problemas de piel', 16.00, 11.00, 15, 3, 'VetCare Products');

-- Configuración de la clínica
INSERT INTO clinic_configuration (id, clinic_name, address, phone, email)
VALUES (
  gen_random_uuid(),
  'Clínica Vet Central',
  'Av. Siempre Viva 742',
  '123456789',
  'contacto@vetclinic.com'
);
