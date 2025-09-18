-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(50),
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suppliers_updated_at 
BEFORE UPDATE ON suppliers 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add supplier_id column to products table if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
