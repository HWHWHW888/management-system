-- ========== 基础表 ==========
CREATE TABLE agents (
    id uuid,
    name text,
    email text,
    phone text,
    created_at timestamptz,
    is_customer boolean,
    customer_id uuid,
    commission_rate numeric,
    created_by uuid,
    status text,
    updated_at timestamptz
);

CREATE TABLE customers (
    id uuid,
    name varchar(255),
    email varchar(255),
    phone varchar(50),
    agent_id uuid,
    agent_name varchar(255),
    total_rolling numeric(15,2),
    total_win_loss numeric(15,2),
    total_buy_in numeric(15,2),
    total_buy_out numeric(15,2),
    credit_limit numeric(15,2),
    available_credit numeric(15,2),
    rolling_percentage numeric(5,2),
    is_agent boolean,
    source_agent_id uuid,
    total_spent numeric(15,2),
    status varchar(50),
    vip_level varchar(50),
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE staff (
    id uuid,
    name varchar(255),
    email varchar(255),
    phone varchar(50),
    position varchar(100),
    status text,
    attachments jsonb,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE users (
    id uuid,
    username varchar(100),
    password varchar(255),
    email varchar(255),
    role text,
    agent_id uuid,
    staff_id uuid,
    status text,
    last_login timestamptz,
    created_at timestamptz,
    updated_at timestamptz
);

-- ========== 业务表 ==========
CREATE TABLE buy_in_out_records (
    id uuid,
    customer_id uuid,
    customer_name text,
    staff_id uuid,
    staff_name text,
    transaction_type text,
    amount numeric,
    timestamp timestamp without time zone,
    venue text,
    table_number text,
    notes text,
    proof_photo uuid,
    shift_id uuid,
    trip_id uuid
);

CREATE TABLE chip_exchanges (
    id uuid,
    customer_id uuid,
    customer_name text,
    staff_id uuid,
    staff_name text,
    amount numeric,
    exchange_type text,
    timestamp timestamp without time zone,
    proof_photo uuid
);

CREATE TABLE rolling_records (
    id uuid,
    customer_id uuid,
    customer_name text,
    agent_id uuid,
    agent_name text,
    staff_id uuid,
    staff_name text,
    rolling_amount numeric,
    game_type uuid,
    venue text,
    table_number text,
    session_start_time timestamp without time zone,
    session_end_time timestamp without time zone,
    recorded_at timestamptz,
    notes text,
    attachments jsonb,
    ocr_data jsonb,
    verified boolean,
    verified_by uuid,
    verified_at timestamp without time zone,
    shift_id uuid,
    trip_id uuid
);

CREATE TABLE transactions (
    id uuid,
    trip_id uuid,
    customer_id uuid,
    agent_id uuid,
    amount numeric(15,2),
    transaction_type varchar(50),
    status varchar(20),
    notes text,
    recorded_by_staff_id uuid,
    created_at timestamptz,
    updated_at timestamptz
);

-- ========== 客户扩展表 ==========
CREATE TABLE customer_details (
    id uuid,
    customer_id uuid,
    passport_number varchar(50),
    id_number varchar(50),
    nationality varchar(100),
    date_of_birth date,
    address text,
    occupation varchar(200),
    hobby text,
    gaming_preferences text,
    emergency_contact varchar(200),
    emergency_phone varchar(50),
    marital_status varchar(50),
    education_level varchar(100),
    income_range varchar(100),
    preferred_language varchar(50),
    communication_preferences jsonb,
    notes text,
    special_requirements text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by uuid,
    updated_by uuid,
    attachments jsonb
);

-- ========== 附件 & OCR ==========
CREATE TABLE file_attachments (
    id uuid,
    name text,
    size bigint,
    type text,
    data text,
    uploaded_at timestamptz,
    uploaded_by uuid
);

CREATE TABLE ocr_data (
    id uuid,
    original_image_id uuid,
    extracted_text text,
    confidence numeric,
    extracted_fields jsonb,
    processed_at timestamp without time zone,
    ocr_engine text
);

-- ========== 游戏 ==========
CREATE TABLE game_types (
    id uuid,
    name text,
    category text,
    is_active boolean
);

-- ========== 行程相关 ==========
CREATE TABLE trips (
    id uuid,
    trip_name varchar(255),
    destination varchar(255),
    start_date date,
    end_date date,
    status varchar(50),
    total_budget numeric(15,2),
    total_win numeric(15,2),
    total_loss numeric(15,2),
    net_profit numeric(15,2),
    staff_id uuid,
    check_in_time timestamptz,
    check_out_time timestamptz,
    check_in_notes text,
    check_out_notes text,
    activeCustomersCount integer DEFAULT 0,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE trip_agents (
    id uuid,
    trip_id uuid,
    agent_id uuid,
    created_at timestamptz
);

CREATE TABLE trip_customers (
    id uuid,
    trip_id uuid,
    customer_id uuid,
    created_at timestamptz
);

CREATE TABLE trip_customer_stats (
    id uuid,
    trip_id uuid,
    customer_id uuid,
    total_buy_in numeric(15,2),
    total_cash_out numeric(15,2),
    total_win numeric(15,2),
    total_loss numeric(15,2),
    net_result numeric(15,2),
    rolling_amount numeric(15,2),
    commission_earned numeric(15,2),
    notes text,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE trip_expenses (
    id uuid,
    trip_id uuid,
    expense_type varchar(100),
    amount numeric(15,2),
    description text,
    expense_date date,
    recorded_by uuid,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE trip_sharing (
    trip_id uuid,
    total_win_loss numeric,
    total_expenses numeric,
    total_rolling_commission numeric,
    total_buy_in numeric,
    total_buy_out numeric,
    net_cash_flow numeric,
    net_result numeric,
    total_agent_share numeric,
    company_share numeric,
    agent_share_percentage numeric,
    company_share_percentage numeric,
    agent_breakdown jsonb
);

-- ========== 班次相关 ==========
CREATE TABLE staff_shifts (
    id uuid,
    staff_id uuid,
    check_in_time timestamptz,
    check_out_time timestamptz,
    shift_date date,
    status varchar(20),
    check_in_photo jsonb,
    check_out_photo jsonb,
    notes text,
    created_at timestamptz,
    updated_at timestamptz
);

-- ========== game_types ==========
ALTER TABLE game_types
  ADD CONSTRAINT game_types_category_check CHECK ((category = ANY (ARRAY['table-games','slots','poker','sports-betting','other']))),
  ADD CONSTRAINT game_types_pkey PRIMARY KEY (id);

-- ========== agents ==========
ALTER TABLE agents
  ADD CONSTRAINT agents_pkey PRIMARY KEY (id);

-- ========== file_attachments ==========
ALTER TABLE file_attachments
  ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);

-- ========== rolling_records ==========
ALTER TABLE rolling_records
  ADD CONSTRAINT rolling_records_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id),
  ADD CONSTRAINT rolling_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id),
  ADD CONSTRAINT rolling_records_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES staff(id),
  ADD CONSTRAINT rolling_records_game_type_fkey FOREIGN KEY (game_type) REFERENCES game_types(id),
  ADD CONSTRAINT rolling_records_pkey PRIMARY KEY (id);

-- ========== ocr_data ==========
ALTER TABLE ocr_data
  ADD CONSTRAINT ocr_data_original_image_id_fkey FOREIGN KEY (original_image_id) REFERENCES file_attachments(id),
  ADD CONSTRAINT ocr_data_pkey PRIMARY KEY (id);

-- ========== chip_exchanges ==========
ALTER TABLE chip_exchanges
  ADD CONSTRAINT chip_exchanges_exchange_type_check CHECK ((exchange_type = ANY (ARRAY['cash-to-chips','chips-to-cash']))),
  ADD CONSTRAINT chip_exchanges_proof_photo_fkey FOREIGN KEY (proof_photo) REFERENCES file_attachments(id),
  ADD CONSTRAINT chip_exchanges_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id),
  ADD CONSTRAINT chip_exchanges_pkey PRIMARY KEY (id);

-- ========== buy_in_out_records ==========
ALTER TABLE buy_in_out_records
  ADD CONSTRAINT buy_in_out_records_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['buy-in','buy-out']))),
  ADD CONSTRAINT buy_in_out_records_proof_photo_fkey FOREIGN KEY (proof_photo) REFERENCES file_attachments(id),
  ADD CONSTRAINT buy_in_out_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id),
  ADD CONSTRAINT buy_in_out_records_pkey PRIMARY KEY (id);

-- ========== customer_details ==========
ALTER TABLE customer_details
  ADD CONSTRAINT customer_details_pkey PRIMARY KEY (id),
  ADD CONSTRAINT customer_details_customer_id_key UNIQUE (customer_id);

-- ========== staff ==========
ALTER TABLE staff
  ADD CONSTRAINT staff_pkey PRIMARY KEY (id),
  ADD CONSTRAINT staff_email_key UNIQUE (email);

-- ========== staff_shifts ==========
ALTER TABLE staff_shifts
  ADD CONSTRAINT staff_shifts_status_check CHECK (status IN ('checked-in','checked-out')),
  ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);

-- ========== users ==========
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin','agent','staff')),
  ADD CONSTRAINT users_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id),
  ADD CONSTRAINT users_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id),
  ADD CONSTRAINT users_pkey PRIMARY KEY (id),
  ADD CONSTRAINT users_username_key UNIQUE (username),
  ADD CONSTRAINT users_email_key UNIQUE (email);

-- ========== trips ==========
ALTER TABLE trips
  ADD CONSTRAINT trips_status_check CHECK (status IN ('active','in-progress','completed','cancelled')),
  ADD CONSTRAINT trips_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id),
  ADD CONSTRAINT trips_pkey PRIMARY KEY (id);

-- ========== trip_customers ==========
ALTER TABLE trip_customers
  ADD CONSTRAINT fk_trip_customers_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT trip_customers_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  ADD CONSTRAINT trip_customers_pkey PRIMARY KEY (id),
  ADD CONSTRAINT trip_customers_trip_id_customer_id_key UNIQUE (trip_id, customer_id);

-- ========== trip_agents ==========
ALTER TABLE trip_agents
  ADD CONSTRAINT trip_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  ADD CONSTRAINT trip_agents_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  ADD CONSTRAINT trip_agents_pkey PRIMARY KEY (id),
  ADD CONSTRAINT trip_agents_trip_id_agent_id_key UNIQUE (trip_id, agent_id);

-- ========== trip_expenses ==========
ALTER TABLE trip_expenses
  ADD CONSTRAINT trip_expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  ADD CONSTRAINT trip_expenses_pkey PRIMARY KEY (id);

-- ========== transactions ==========
ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed','cancelled')),
  ADD CONSTRAINT transactions_transaction_type_check CHECK (transaction_type IN ('buy-in','cash-out')),
  ADD CONSTRAINT transactions_recorded_by_staff_id_fkey FOREIGN KEY (recorded_by_staff_id) REFERENCES staff(id),
  ADD CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT transactions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id),
  ADD CONSTRAINT transactions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id),
  ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

-- ========== trip_customer_stats ==========
ALTER TABLE trip_customer_stats
  ADD CONSTRAINT fk_trip_customer_stats_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT trip_customer_stats_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  ADD CONSTRAINT trip_customer_stats_pkey PRIMARY KEY (id),
  ADD CONSTRAINT trip_customer_stats_trip_id_customer_id_key UNIQUE (trip_id, customer_id);

-- ========== customers ==========
ALTER TABLE customers
  ADD CONSTRAINT customers_status_check CHECK (status IN ('active','inactive')),
  ADD CONSTRAINT customers_vip_level_check CHECK (vip_level IN ('Silver','Gold','Platinum')),
  ADD CONSTRAINT customers_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id),
  ADD CONSTRAINT customers_pkey PRIMARY KEY (id),
  ADD CONSTRAINT customers_email_key UNIQUE (email);


-- ========== agents ==========
CREATE UNIQUE INDEX agents_pkey ON public.agents USING btree (id);
CREATE INDEX idx_agents_customer_id ON public.agents USING btree (customer_id);
CREATE INDEX idx_agents_email ON public.agents USING btree (email);
CREATE INDEX idx_agents_status ON public.agents USING btree (status);

-- ========== buy_in_out_records ==========
CREATE UNIQUE INDEX buy_in_out_records_pkey ON public.buy_in_out_records USING btree (id);
CREATE INDEX idx_buy_in_out_records_customer_id ON public.buy_in_out_records USING btree (customer_id);
CREATE INDEX idx_buy_in_out_records_shift_id ON public.buy_in_out_records USING btree (shift_id);
CREATE INDEX idx_buy_in_out_records_staff_id ON public.buy_in_out_records USING btree (staff_id);
CREATE INDEX idx_buy_in_out_records_trip_id ON public.buy_in_out_records USING btree (trip_id);

-- ========== chip_exchanges ==========
CREATE UNIQUE INDEX chip_exchanges_pkey ON public.chip_exchanges USING btree (id);
CREATE INDEX idx_chip_exchanges_customer_id ON public.chip_exchanges USING btree (customer_id);
CREATE INDEX idx_chip_exchanges_proof_photo ON public.chip_exchanges USING btree (proof_photo);
CREATE INDEX idx_chip_exchanges_staff_id ON public.chip_exchanges USING btree (staff_id);

-- ========== customer_details ==========
CREATE UNIQUE INDEX customer_details_customer_id_key ON public.customer_details USING btree (customer_id);
CREATE UNIQUE INDEX customer_details_pkey ON public.customer_details USING btree (id);
CREATE INDEX idx_customer_details_attachments ON public.customer_details USING gin (attachments);
CREATE INDEX idx_customer_details_customer_id ON public.customer_details USING btree (customer_id);
CREATE INDEX idx_customer_details_id_number ON public.customer_details USING btree (id_number) WHERE (id_number IS NOT NULL);
CREATE INDEX idx_customer_details_passport ON public.customer_details USING btree (passport_number) WHERE (passport_number IS NOT NULL);

-- ========== customers ==========
CREATE UNIQUE INDEX customers_email_key ON public.customers USING btree (email);
CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);
CREATE INDEX idx_customers_agent_id ON public.customers USING btree (agent_id);
CREATE INDEX idx_customers_email ON public.customers USING btree (email);
CREATE INDEX idx_customers_source_agent_id ON public.customers USING btree (source_agent_id);
CREATE INDEX idx_customers_status ON public.customers USING btree (status);

-- ========== file_attachments ==========
CREATE UNIQUE INDEX file_attachments_pkey ON public.file_attachments USING btree (id);
CREATE INDEX idx_file_attachments_uploaded_by ON public.file_attachments USING btree (uploaded_by);

-- ========== game_types ==========
CREATE UNIQUE INDEX game_types_pkey ON public.game_types USING btree (id);

-- ========== ocr_data ==========
CREATE INDEX idx_ocr_data_original_image_id ON public.ocr_data USING btree (original_image_id);
CREATE UNIQUE INDEX ocr_data_pkey ON public.ocr_data USING btree (id);

-- ========== rolling_records ==========
CREATE INDEX idx_rolling_records_agent_id ON public.rolling_records USING btree (agent_id);
CREATE INDEX idx_rolling_records_customer_id ON public.rolling_records USING btree (customer_id);
CREATE INDEX idx_rolling_records_game_type ON public.rolling_records USING btree (game_type);
CREATE INDEX idx_rolling_records_shift_id ON public.rolling_records USING btree (shift_id);
CREATE INDEX idx_rolling_records_staff_id ON public.rolling_records USING btree (staff_id);
CREATE INDEX idx_rolling_records_trip_id ON public.rolling_records USING btree (trip_id);
CREATE UNIQUE INDEX rolling_records_pkey ON public.rolling_records USING btree (id);

-- ========== staff ==========
CREATE INDEX idx_staff_attachments ON public.staff USING gin (attachments);
CREATE INDEX idx_staff_email ON public.staff USING btree (email);
CREATE INDEX idx_staff_status ON public.staff USING btree (status);
CREATE UNIQUE INDEX staff_email_key ON public.staff USING btree (email);
CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id);

-- ========== staff_shifts ==========
CREATE INDEX idx_staff_shifts_date ON public.staff_shifts USING btree (shift_date);
CREATE INDEX idx_staff_shifts_staff_date ON public.staff_shifts USING btree (staff_id, shift_date);
CREATE INDEX idx_staff_shifts_staff_id ON public.staff_shifts USING btree (staff_id);
CREATE INDEX idx_staff_shifts_status ON public.staff_shifts USING btree (status);
CREATE UNIQUE INDEX staff_shifts_pkey ON public.staff_shifts USING btree (id);

-- ========== transactions ==========
CREATE INDEX idx_transactions_agent_id ON public.transactions USING btree (agent_id);
CREATE INDEX idx_transactions_customer_id ON public.transactions USING btree (customer_id);
CREATE INDEX idx_transactions_trip_id ON public.transactions USING btree (trip_id);
CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);

-- ========== trip_agents ==========
CREATE INDEX idx_trip_agents_agent_id ON public.trip_agents USING btree (agent_id);
CREATE INDEX idx_trip_agents_trip_id ON public.trip_agents USING btree (trip_id);
CREATE UNIQUE INDEX trip_agents_pkey ON public.trip_agents USING btree (id);
CREATE UNIQUE INDEX trip_agents_trip_id_agent_id_key ON public.trip_agents USING btree (trip_id, agent_id);

-- ========== trip_customer_stats ==========
CREATE UNIQUE INDEX trip_customer_stats_pkey ON public.trip_customer_stats USING btree (id);
CREATE UNIQUE INDEX trip_customer_stats_trip_id_customer_id_key ON public.trip_customer_stats USING btree (trip_id, customer_id);

-- ========== trip_customers ==========
CREATE INDEX idx_trip_customers_customer_id ON public.trip_customers USING btree (customer_id);
CREATE INDEX idx_trip_customers_trip_id ON public.trip_customers USING btree (trip_id);
CREATE UNIQUE INDEX trip_customers_pkey ON public.trip_customers USING btree (id);
CREATE UNIQUE INDEX trip_customers_trip_id_customer_id_key ON public.trip_customers USING btree (trip_id, customer_id);

-- ========== trip_expenses ==========
CREATE INDEX idx_trip_expenses_trip_id ON public.trip_expenses USING btree (trip_id);
CREATE UNIQUE INDEX trip_expenses_pkey ON public.trip_expenses USING btree (id);

-- ========== trip_sharing ==========
CREATE INDEX idx_trip_sharing_trip_id ON public.trip_sharing USING btree (trip_id);

-- ========== trips ==========
CREATE INDEX idx_trips_dates ON public.trips USING btree (start_date, end_date);
CREATE INDEX idx_trips_staff_id ON public.trips USING btree (staff_id);
CREATE INDEX idx_trips_status ON public.trips USING btree (status);
CREATE UNIQUE INDEX trips_pkey ON public.trips USING btree (id);

-- ========== users ==========
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

-- Add total_commission and total_trips columns to agents table
ALTER TABLE agents 
ADD COLUMN total_commission numeric(15,2) DEFAULT 0.00,
ADD COLUMN total_trips integer DEFAULT 0;

-- Update existing agents to have default values
UPDATE agents 
SET total_commission = 0.00, total_trips = 0 
WHERE total_commission IS NULL OR total_trips IS NULL;

-- Create index for better performance on statistics queries
CREATE INDEX idx_agents_total_commission ON agents(total_commission);
CREATE INDEX idx_agents_total_trips ON agents(total_trips);
