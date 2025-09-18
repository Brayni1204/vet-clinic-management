-- Unified Veterinary Clinic Database Schema
-- This file consolidates all table structures into a single, unified design

-- Drop existing tables if they exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS client_orders CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS items_factura CASCADE;
DROP TABLE IF EXISTS facturas CASCADE;
DROP TABLE IF EXISTS items_pedido CASCADE;
DROP TABLE IF EXISTS pedidos_cliente CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS historiales_medicos CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS citas CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS mascotas CASCADE;
DROP TABLE IF EXISTS owners CASCADE;
DROP TABLE IF EXISTS duenos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS personal CASCADE;
DROP TABLE IF EXISTS clinic_configuration CASCADE;

-- Create unified users table (staff/personal)
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'veterinarian', 'receptionist')),
    phone VARCHAR(20),
    specialty VARCHAR(100),
    license_number VARCHAR(50),
    hire_date DATE,
    salary DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified owners table (pet owners/clients)
CREATE TABLE owners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified pets table
CREATE TABLE pets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL,
    breed VARCHAR(100),
    color VARCHAR(50),
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Macho', 'Hembra')),
    date_of_birth DATE,
    weight DECIMAL(5,2),
    microchip_number VARCHAR(50),
    active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified products table
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- medication, services, food, supplies
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    supplier VARCHAR(200),
    barcode VARCHAR(100),
    expiration_date DATE,
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified appointments table
CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    veterinarian_id UUID REFERENCES users(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified medical records table
CREATE TABLE medical_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    veterinarian_id UUID NOT NULL REFERENCES users(id),
    visit_date DATE NOT NULL,
    reason_for_visit TEXT NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    treatment TEXT,
    medications TEXT,
    follow_up_notes TEXT,
    weight DECIMAL(5,2),
    temperature DECIMAL(4,1),
    next_appointment DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified invoices table
CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES owners(id),
    pet_id UUID REFERENCES pets(id),
    appointment_id UUID REFERENCES appointments(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified invoice items table
CREATE TABLE invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified client orders table (for online portal) - NO OWNER REFERENCE
CREATE TABLE client_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    delivery_address TEXT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    estimated_delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unified order items table
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES client_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clinic configuration table
CREATE TABLE clinic_configuration (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_name VARCHAR(255) NOT NULL DEFAULT 'VetClinic Pro',
    clinic_address TEXT,
    clinic_phone VARCHAR(20),
    clinic_email VARCHAR(255),
    business_hours JSONB,
    tax_rate DECIMAL(5,4) DEFAULT 0.0875,
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    appointment_duration INTEGER DEFAULT 30,
    max_appointments_per_day INTEGER DEFAULT 50,
    emergency_contact VARCHAR(20),
    logo_url VARCHAR(500),
    theme_color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_pets_owner ON pets(owner_id);
CREATE INDEX idx_pets_active ON pets(active);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_pet ON appointments(pet_id);
CREATE INDEX idx_appointments_veterinarian ON appointments(veterinarian_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_medical_records_pet ON medical_records(pet_id);
CREATE INDEX idx_medical_records_date ON medical_records(visit_date);
CREATE INDEX idx_medical_records_veterinarian ON medical_records(veterinarian_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_owner ON invoices(owner_id);
CREATE INDEX idx_invoices_status ON invoices(payment_status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_client_orders_status ON client_orders(status);
CREATE INDEX idx_client_orders_date ON client_orders(created_at);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_owners_updated_at BEFORE UPDATE ON owners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_orders_updated_at BEFORE UPDATE ON client_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clinic_configuration_updated_at BEFORE UPDATE ON clinic_configuration FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

alter table public.client_orders
  add column order_date date not null default current_date;