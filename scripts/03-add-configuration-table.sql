-- Create clinic configuration table
CREATE TABLE IF NOT EXISTS clinic_configuration (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_name VARCHAR(255) DEFAULT 'VetClinic Pro',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    opening_hours TIME DEFAULT '08:00',
    closing_hours TIME DEFAULT '18:00',
    default_appointment_duration INTEGER DEFAULT 30,
    appointment_reminders BOOLEAN DEFAULT true,
    reminder_hours_before INTEGER DEFAULT 24,
    allow_online_appointments BOOLEAN DEFAULT true,
    default_tax_rate DECIMAL(5,2) DEFAULT 16.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    invoice_prefix VARCHAR(10) DEFAULT 'FAC-',
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    low_stock_alerts BOOLEAN DEFAULT true,
    session_timeout_hours INTEGER DEFAULT 8,
    require_password_change BOOLEAN DEFAULT false,
    max_login_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clinic_configuration_updated_at 
    BEFORE UPDATE ON clinic_configuration 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration
INSERT INTO clinic_configuration (
    clinic_name,
    address,
    phone,
    email
) VALUES (
    'VetClinic Pro',
    'Calle Principal 123',
    '+34 123 456 789',
    'info@vetclinicpro.com'
) ON CONFLICT (id) DO NOTHING;
