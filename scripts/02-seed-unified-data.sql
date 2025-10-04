-- Seed data for unified veterinary clinic database

-- Insert demo users (staff)
INSERT INTO users (id, email, password_hash, full_name, role, phone, specialty, status) VALUES
(gen_random_uuid(), 'admin@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. María González', 'admin', '555-0101', 'Administración', 'active'),
(gen_random_uuid(), 'vet@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Carlos Rodríguez', 'veterinarian', '555-0102', 'Medicina General', 'active'),
(gen_random_uuid(), 'reception@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ana Martínez', 'receptionist', '555-0103', NULL, 'active'),
(gen_random_uuid(), 'vet2@veterinaria.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Laura Fernández', 'veterinarian', '555-0104', 'Cirugía', 'active');

-- Insert demo owners (pet owners)
INSERT INTO owners (id, first_name, last_name, email, phone, address, city, state, zip_code) VALUES
(gen_random_uuid(), 'Juan', 'Pérez', 'juan.perez@email.com', '555-1001', 'Av. Héroes del Cenepa 123', 'Bagua', 'Amazonas', '05141'),
(gen_random_uuid(), 'María', 'García', 'maria.garcia@email.com', '555-1002', 'Jr. Amazonas 456', 'Bagua', 'Amazonas', '05141'),
(gen_random_uuid(), 'Luis', 'López', 'luis.lopez@email.com', '555-1003', 'Jr. San Martín 789', 'Bagua', 'Amazonas', '05141'),
(gen_random_uuid(), 'Carmen', 'Sánchez', 'carmen.sanchez@email.com', '555-1004', 'Jr. Grau 321', 'Bagua', 'Amazonas', '05141'),
(gen_random_uuid(), 'Roberto', 'Díaz', 'roberto.diaz@email.com', '555-1005', 'Av. Bagua Grande 654', 'Bagua', 'Amazonas', '05141');

-- Insert demo pets (using owner IDs from above)
INSERT INTO pets (owner_id, name, species, breed, color, gender, date_of_birth, weight)
SELECT
    o.id,
    pet_data.name,
    pet_data.species,
    pet_data.breed,
    pet_data.color,
    pet_data.gender,
    pet_data.date_of_birth::date,
    pet_data.weight
FROM owners o
CROSS JOIN (
    VALUES
        ('Max', 'Perro', 'Golden Retriever', 'Dorado', 'Macho', '2020-05-15', 30.5),
        ('Luna', 'Gato', 'Persian', 'Blanco', 'Hembra', '2019-08-22', 8.2),
        ('Rocky', 'Perro', 'German Shepherd', 'Marrón', 'Macho', '2018-12-10', 35.0),
        ('Mimi', 'Gato', 'Siamese', 'Gris', 'Hembra', '2021-03-08', 6.5),
        ('Buddy', 'Perro', 'Labrador', 'Negro', 'Macho', '2019-11-30', 28.0)
) AS pet_data(name, species, breed, color, gender, date_of_birth, weight)
WHERE o.first_name IN ('Juan', 'María', 'Luis', 'Carmen', 'Roberto')
LIMIT 5;


-- Insert demo products
INSERT INTO products (name, category, description, price, cost, stock_quantity, low_stock_threshold, supplier) VALUES
('Vacuna Antirrábica', 'medicamento', 'Vacuna contra la rabia para perros y gatos', 25.00, 15.00, 50, 10, 'MedVet Supply'),
('Desparasitante Interno', 'medicamento', 'Tratamiento contra parásitos internos', 18.50, 12.00, 30, 5, 'VetPharm'),
('Consulta General', 'servicio', 'Consulta veterinaria general', 45.00, 0.00, 999, 0, 'Servicio Interno'),
('Cirugía Menor', 'servicio', 'Procedimientos quirúrgicos menores', 150.00, 0.00, 999, 0, 'Servicio Interno'),
('Comida Premium Perro', 'alimento', 'Alimento balanceado premium para perros', 35.00, 25.00, 20, 5, 'Pet Food Co'),
('Juguete Interactivo', 'accesorios', 'Juguete para estimulación mental', 12.00, 8.00, 25, 3, 'Pet Toys Inc'),
('Collar Antipulgas', 'accesorios', 'Collar preventivo contra pulgas y garrapatas', 22.00, 16.00, 40, 8, 'Pest Control Supply'),
('Shampoo Medicinal', 'medicamento', 'Shampoo para problemas de piel', 16.00, 11.00, 15, 3, 'VetCare Products');

-- Insert demo appointments
INSERT INTO appointments (pet_id, owner_id, veterinarian_id, appointment_date, appointment_time, reason, status)
SELECT
    p.id,
    p.owner_id,
    u.id,
    CURRENT_DATE + INTERVAL '1 day' * (ROW_NUMBER() OVER ()),
    '10:00:00'::TIME + INTERVAL '30 minutes' * (ROW_NUMBER() OVER ()),
    CASE
        WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 'Consulta de rutina'
        WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 'Vacunación'
        WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 'Revisión post-operatoria'
        ELSE 'Consulta por enfermedad'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'scheduled'
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 'confirmed'
        ELSE 'completed'
    END
FROM pets p
CROSS JOIN users u
WHERE u.role = 'veterinarian'
LIMIT 10;


-- Insert demo medical records
INSERT INTO medical_records (pet_id, veterinarian_id, visit_date, reason_for_visit, symptoms, diagnosis, treatment, medications, weight, temperature)
SELECT
    p.id,
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * (ROW_NUMBER() OVER ()),
    'Consulta de rutina',
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'Sin síntomas aparentes'
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 'Letargo leve, pérdida de apetito'
        ELSE 'Tos ocasional, estornudos'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'Animal sano'
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 'Gastroenteritis leve'
        ELSE 'Resfriado común'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'Mantenimiento preventivo'
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 'Dieta blanda, hidratación'
        ELSE 'Descanso, medicación sintomática'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'Vitaminas'
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 'Probióticos'
        ELSE 'Expectorante'
    END,
    p.weight,
    CASE
        WHEN p.species = 'Perro' THEN 38.5
        WHEN p.species = 'Gato' THEN 38.0
        ELSE 38.2
    END
FROM pets p
CROSS JOIN users u
WHERE u.role = 'veterinarian'
LIMIT 8;

-- Insert demo invoices
INSERT INTO invoices (owner_id, pet_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, payment_status, payment_method)
SELECT
    o.id,
    p.id,
    'INV-' || LPAD((ROW_NUMBER() OVER ())::TEXT, 6, '0'),
    CURRENT_DATE - INTERVAL '1 day' * (ROW_NUMBER() OVER ()),
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 45.00
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 78.50
        ELSE 125.00
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 3.94
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 6.87
        ELSE 10.94
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 48.94
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 85.37
        ELSE 135.94
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 2 = 1 THEN 'paid'
        ELSE 'pending'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 2 = 1 THEN 'card'
        ELSE 'cash'
    END
FROM owners o
JOIN pets p ON p.owner_id = o.id
LIMIT 6;

-- Insert demo client orders
INSERT INTO client_orders (
  order_number,
  client_name,
  client_email,
  client_phone,
  delivery_address,
  subtotal,
  tax_amount,
  total_amount,
  status,
  payment_method
)
SELECT
    'ORD-' || LPAD((ROW_NUMBER() OVER ())::TEXT, 6, '0'),
    o.first_name || ' ' || o.last_name,
    o.email,
    o.phone,
    COALESCE(o.address, 'Jr. Sin Nombre 123, Bagua'),
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 35.00
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 67.50
        ELSE 89.00
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 3.06
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 5.91
        ELSE 7.79
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 38.06
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 73.41
        ELSE 96.79
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 'pending'
        WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 'confirmed'
        WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 'preparing'
        ELSE 'shipped'
    END,
    CASE
        WHEN ROW_NUMBER() OVER () % 2 = 1 THEN 'card'
        ELSE 'paypal'
    END
FROM owners o
LIMIT 5;

-- Insert demo order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT
    co.id,
    p.id,
    CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 1
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 2
        ELSE 3
    END,
    p.price,
    p.price * CASE
        WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 1
        WHEN ROW_NUMBER() OVER () % 3 = 2 THEN 2
        ELSE 3
    END
FROM client_orders co
CROSS JOIN products p
WHERE p.category IN ('alimento', 'accesorios')
ORDER BY co.created_at, p.name
LIMIT 10;

-- Insert demo clinic configuration
INSERT INTO clinic_configuration (
    clinic_name,
    clinic_address,
    clinic_phone,
    clinic_email,
    appointment_duration,
    tax_rate
)
VALUES (
    'VetClinic Pro',
    'Jr. Veterinarios 123, Bagua, Amazonas 05141, Perú',
    '555-VET-CARE',
    'info@vetclinicpro.com',
    30,
    0.0875
);