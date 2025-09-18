-- Add order_time column to client_orders table
ALTER TABLE public.client_orders 
ADD COLUMN IF NOT EXISTS order_time VARCHAR(10);
