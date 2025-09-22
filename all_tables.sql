create table public.agents (
  id uuid not null default gen_random_uuid (),
  name text null,
  email text null,
  phone text null,
  created_at timestamp with time zone null default now(),
  is_customer boolean null default true,
  customer_id uuid null,
  commission_rate numeric null default 0,
  created_by uuid null default '80709c8d-8bca-4e4b-817f-c6219d8af871'::uuid,
  status text null default 'active'::text,
  updated_at timestamp with time zone null default now(),
  total_commission numeric(15, 2) null default 0.00,
  total_trips integer null default 0,
  constraint agents_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_agents_customer_id on public.agents using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_agents_email on public.agents using btree (email) TABLESPACE pg_default;

create index IF not exists idx_agents_status on public.agents using btree (status) TABLESPACE pg_default;

create index IF not exists idx_agents_total_commission on public.agents using btree (total_commission) TABLESPACE pg_default;

create index IF not exists idx_agents_total_trips on public.agents using btree (total_trips) TABLESPACE pg_default;


create table public.buy_in_out_records (
  id uuid not null default gen_random_uuid (),
  customer_id uuid null,
  customer_name text null,
  staff_id uuid null,
  staff_name text null,
  transaction_type text null,
  amount numeric null,
  timestamp timestamp without time zone null,
  venue text null,
  table_number text null,
  notes text null,
  proof_photo uuid null,
  shift_id uuid null,
  trip_id uuid null,
  constraint buy_in_out_records_pkey primary key (id),
  constraint buy_in_out_records_proof_photo_fkey foreign KEY (proof_photo) references file_attachments (id),
  constraint buy_in_out_records_staff_id_fkey foreign KEY (staff_id) references staff (id),
  constraint buy_in_out_records_transaction_type_check check (
    (
      transaction_type = any (array['buy-in'::text, 'buy-out'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_buy_in_out_records_customer_id on public.buy_in_out_records using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_buy_in_out_records_staff_id on public.buy_in_out_records using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_buy_in_out_records_shift_id on public.buy_in_out_records using btree (shift_id) TABLESPACE pg_default;

create index IF not exists idx_buy_in_out_records_trip_id on public.buy_in_out_records using btree (trip_id) TABLESPACE pg_default;

create table public.chip_exchanges (
  id uuid not null default gen_random_uuid (),
  customer_id uuid null,
  customer_name text null,
  staff_id uuid null,
  staff_name text null,
  amount numeric null,
  exchange_type text null,
  timestamp timestamp without time zone null,
  proof_photo uuid null,
  constraint chip_exchanges_pkey primary key (id),
  constraint chip_exchanges_proof_photo_fkey foreign KEY (proof_photo) references file_attachments (id),
  constraint chip_exchanges_staff_id_fkey foreign KEY (staff_id) references staff (id),
  constraint chip_exchanges_exchange_type_check check (
    (
      exchange_type = any (
        array['cash-to-chips'::text, 'chips-to-cash'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_chip_exchanges_customer_id on public.chip_exchanges using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_chip_exchanges_staff_id on public.chip_exchanges using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_chip_exchanges_proof_photo on public.chip_exchanges using btree (proof_photo) TABLESPACE pg_default;

create table public.customer_details (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  passport_number character varying(50) null,
  id_number character varying(50) null,
  nationality character varying(100) null,
  date_of_birth date null,
  address text null,
  occupation character varying(200) null,
  hobby text null,
  gaming_preferences text null,
  emergency_contact character varying(200) null,
  emergency_phone character varying(50) null,
  marital_status character varying(50) null,
  education_level character varying(100) null,
  income_range character varying(100) null,
  preferred_language character varying(50) null default 'English'::character varying,
  communication_preferences jsonb null,
  notes text null,
  special_requirements text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  updated_by uuid null,
  attachments jsonb null default '[]'::jsonb,
  passport_photo jsonb null default '{}'::jsonb,
  passport_file_name character varying(255) null,
  passport_file_type character varying(100) null,
  passport_file_size integer null,
  passport_uploaded_at timestamp with time zone null,
  constraint customer_details_pkey primary key (id),
  constraint customer_details_customer_id_key unique (customer_id)
) TABLESPACE pg_default;

create index IF not exists idx_customer_details_customer_id on public.customer_details using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_customer_details_passport on public.customer_details using btree (passport_number) TABLESPACE pg_default
where
  (passport_number is not null);

create index IF not exists idx_customer_details_id_number on public.customer_details using btree (id_number) TABLESPACE pg_default
where
  (id_number is not null);

create index IF not exists idx_customer_details_attachments on public.customer_details using gin (attachments) TABLESPACE pg_default;

create trigger trigger_update_customer_details_updated_at BEFORE
update on customer_details for EACH row
execute FUNCTION update_customer_details_updated_at ();

create table public.customers (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  email character varying(255) not null,
  phone character varying(50) null,
  agent_id uuid null,
  agent_name character varying(255) null,
  total_rolling numeric(15, 2) null default 0,
  total_win_loss numeric(15, 2) null default 0,
  total_buy_in numeric(15, 2) null default 0,
  total_buy_out numeric(15, 2) null default 0,
  credit_limit numeric(15, 2) null default 0,
  available_credit numeric(15, 2) null default 0,
  rolling_percentage numeric(5, 2) null default 0,
  is_agent boolean null default false,
  source_agent_id uuid null,
  total_spent numeric(15, 2) null default 0,
  status character varying(50) null default 'active'::character varying,
  vip_level character varying(50) null default 'Silver'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_email_key unique (email),
  constraint customers_agent_id_fkey foreign KEY (agent_id) references agents (id),
  constraint customers_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'inactive'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint customers_vip_level_check check (
    (
      (vip_level)::text = any (
        (
          array[
            'Silver'::character varying,
            'Gold'::character varying,
            'Platinum'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_customers_agent_id on public.customers using btree (agent_id) TABLESPACE pg_default;

create index IF not exists idx_customers_source_agent_id on public.customers using btree (source_agent_id) TABLESPACE pg_default;

create index IF not exists idx_customers_email on public.customers using btree (email) TABLESPACE pg_default;

create index IF not exists idx_customers_status on public.customers using btree (status) TABLESPACE pg_default;

create table public.file_attachments (
  id uuid not null default gen_random_uuid (),
  name text null,
  size bigint null,
  type text null,
  data text null,
  uploaded_at timestamp with time zone null default now(),
  uploaded_by uuid null,
  constraint file_attachments_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_file_attachments_uploaded_by on public.file_attachments using btree (uploaded_by) TABLESPACE pg_default;

create table public.game_types (
  id uuid not null default gen_random_uuid (),
  name text null,
  category text null,
  is_active boolean null default true,
  constraint game_types_pkey primary key (id),
  constraint game_types_category_check check (
    (
      category = any (
        array[
          'table-games'::text,
          'slots'::text,
          'poker'::text,
          'sports-betting'::text,
          'other'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create table public.ocr_data (
  id uuid not null default gen_random_uuid (),
  original_image_id uuid null,
  extracted_text text null,
  confidence numeric null,
  extracted_fields jsonb null,
  processed_at timestamp without time zone null,
  ocr_engine text null,
  constraint ocr_data_pkey primary key (id),
  constraint ocr_data_original_image_id_fkey foreign KEY (original_image_id) references file_attachments (id)
) TABLESPACE pg_default;

create index IF not exists idx_ocr_data_original_image_id on public.ocr_data using btree (original_image_id) TABLESPACE pg_default;

create table public.staff (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  email character varying(255) not null,
  phone character varying(50) null,
  position character varying(100) not null,
  status text null default 'active'::text,
  attachments jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint staff_pkey primary key (id),
  constraint staff_email_key unique (email)
) TABLESPACE pg_default;

create index IF not exists idx_staff_email on public.staff using btree (email) TABLESPACE pg_default;

create index IF not exists idx_staff_status on public.staff using btree (status) TABLESPACE pg_default;

create index IF not exists idx_staff_attachments on public.staff using gin (attachments) TABLESPACE pg_default;

create trigger update_staff_updated_at BEFORE
update on staff for EACH row
execute FUNCTION update_updated_at_column ();

create table public.staff_shifts (
  id uuid not null default gen_random_uuid (),
  staff_id uuid not null,
  check_in_time timestamp with time zone not null,
  check_out_time timestamp with time zone null,
  shift_date date not null,
  status character varying(20) null default 'checked-in'::character varying,
  check_in_photo jsonb null,
  check_out_photo jsonb null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint staff_shifts_pkey primary key (id),
  constraint staff_shifts_staff_id_fkey foreign KEY (staff_id) references staff (id) on delete CASCADE,
  constraint staff_shifts_status_check check (
    (
      (status)::text = any (
        (
          array[
            'checked-in'::character varying,
            'checked-out'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_staff_shifts_staff_id on public.staff_shifts using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_staff_shifts_date on public.staff_shifts using btree (shift_date) TABLESPACE pg_default;

create index IF not exists idx_staff_shifts_status on public.staff_shifts using btree (status) TABLESPACE pg_default;

create index IF not exists idx_staff_shifts_staff_date on public.staff_shifts using btree (staff_id, shift_date) TABLESPACE pg_default;

create trigger update_staff_shifts_updated_at BEFORE
update on staff_shifts for EACH row
execute FUNCTION update_updated_at_column ();

create table public.transactions (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  customer_id uuid null,
  agent_id uuid null,
  amount numeric(15, 2) not null,
  transaction_type character varying(50) not null,
  status character varying(20) null default 'completed'::character varying,
  notes text null,
  recorded_by_staff_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint transactions_pkey primary key (id),
  constraint transactions_agent_id_fkey foreign KEY (agent_id) references agents (id),
  constraint fk_transactions_customer foreign KEY (customer_id) references customers (id),
  constraint transactions_recorded_by_staff_id_fkey foreign KEY (recorded_by_staff_id) references staff (id),
  constraint transactions_trip_id_fkey foreign KEY (trip_id) references trips (id),
  constraint transactions_transaction_type_check check (
    (
      (transaction_type)::text = any (
        (
          array[
            'buy-in'::character varying,
            'cash-out'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint transactions_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'completed'::character varying,
            'cancelled'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_transactions_trip_id on public.transactions using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_customer_id on public.transactions using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_agent_id on public.transactions using btree (agent_id) TABLESPACE pg_default;

create table public.trip_agent_customers (
  id uuid not null default gen_random_uuid (),
  trip_id uuid not null,
  agent_id uuid not null,
  customer_id uuid not null,
  commission_rate numeric(5, 2) null default 0.00,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint trip_agent_customers_pkey primary key (id),
  constraint trip_agent_customers_unique unique (trip_id, agent_id, customer_id),
  constraint fk_trip_agent_customers_agent foreign KEY (agent_id) references agents (id) on delete CASCADE,
  constraint fk_trip_agent_customers_customer foreign KEY (customer_id) references customers (id) on delete CASCADE,
  constraint fk_trip_agent_customers_trip foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_agent_customers_trip_id on public.trip_agent_customers using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_trip_agent_customers_agent_id on public.trip_agent_customers using btree (agent_id) TABLESPACE pg_default;

create index IF not exists idx_trip_agent_customers_customer_id on public.trip_agent_customers using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_trip_agent_customers_trip_agent on public.trip_agent_customers using btree (trip_id, agent_id) TABLESPACE pg_default;

create table public.trip_agents (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  agent_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint trip_agents_pkey primary key (id),
  constraint trip_agents_trip_id_agent_id_key unique (trip_id, agent_id),
  constraint trip_agents_agent_id_fkey foreign KEY (agent_id) references agents (id) on delete CASCADE,
  constraint trip_agents_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_agents_trip_id on public.trip_agents using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_trip_agents_agent_id on public.trip_agents using btree (agent_id) TABLESPACE pg_default;

create table public.trip_customer_stats (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  customer_id uuid null,
  total_buy_in numeric(15, 2) null default 0,
  total_cash_out numeric(15, 2) null default 0,
  net_result numeric(15, 2) null default 0,
  rolling_amount numeric(15, 2) null default 0,
  commission_earned numeric(15, 2) null default 0,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  total_win_loss numeric(15, 2) null default 0,
  constraint trip_customer_stats_pkey primary key (id),
  constraint trip_customer_stats_trip_id_customer_id_key unique (trip_id, customer_id),
  constraint fk_trip_customer_stats_customer foreign KEY (customer_id) references customers (id),
  constraint trip_customer_stats_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.trip_customers (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  customer_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint trip_customers_pkey primary key (id),
  constraint trip_customers_trip_id_customer_id_key unique (trip_id, customer_id),
  constraint fk_trip_customers_customer foreign KEY (customer_id) references customers (id),
  constraint trip_customers_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_customers_trip_id on public.trip_customers using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_trip_customers_customer_id on public.trip_customers using btree (customer_id) TABLESPACE pg_default;

create trigger trigger_update_trip_customer_count_delete
after DELETE on trip_customers for EACH row
execute FUNCTION update_trip_customer_count ();

create trigger trigger_update_trip_customer_count_insert
after INSERT on trip_customers for EACH row
execute FUNCTION update_trip_customer_count ();

create table public.trip_expenses (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  expense_type character varying(100) not null,
  amount numeric(15, 2) not null,
  description text null,
  expense_date date not null,
  recorded_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint trip_expenses_pkey primary key (id),
  constraint trip_expenses_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_expenses_trip_id on public.trip_expenses using btree (trip_id) TABLESPACE pg_default;

create table public.trip_rolling (
  id uuid not null default gen_random_uuid (),
  trip_id uuid not null,
  customer_id uuid not null,
  staff_id uuid not null,
  game_type text not null,
  rolling_amount numeric not null default 0,
  notes text null,
  attachment_id uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint trip_rolling_pkey primary key (id),
  constraint trip_rolling_attachment_id_fkey foreign KEY (attachment_id) references file_attachments (id),
  constraint trip_rolling_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete CASCADE,
  constraint trip_rolling_staff_id_fkey foreign KEY (staff_id) references staff (id),
  constraint trip_rolling_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_trip_id on public.trip_rolling using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_customer_id on public.trip_rolling using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_staff_id on public.trip_rolling using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_attachment_id on public.trip_rolling using btree (attachment_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_created_at on public.trip_rolling using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_trip_customer on public.trip_rolling using btree (trip_id, customer_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_trip_staff on public.trip_rolling using btree (trip_id, staff_id) TABLESPACE pg_default;

create index IF not exists idx_trip_rolling_game_type on public.trip_rolling using btree (game_type) TABLESPACE pg_default;

create table public.trip_sharing (
  trip_id uuid not null,
  total_win_loss numeric null,
  total_expenses numeric null,
  total_rolling_commission numeric null,
  total_buy_in numeric null,
  total_buy_out numeric null,
  net_cash_flow numeric null,
  net_result numeric null,
  total_agent_share numeric null,
  company_share numeric null,
  agent_share_percentage numeric null,
  company_share_percentage numeric null,
  agent_breakdown jsonb null,
  total_rolling numeric(15, 2) null default 0,
  constraint trip_sharing_pkey primary key (trip_id)
) TABLESPACE pg_default;

create index IF not exists idx_trip_sharing_trip_id on public.trip_sharing using btree (trip_id) TABLESPACE pg_default;

create table public.trip_staff (
  id uuid not null default gen_random_uuid (),
  trip_id uuid not null,
  staff_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint trip_staff_pkey primary key (id),
  constraint trip_staff_unique unique (trip_id, staff_id),
  constraint trip_staff_staff_id_fkey foreign KEY (staff_id) references staff (id) on delete CASCADE,
  constraint trip_staff_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trip_staff_trip_id on public.trip_staff using btree (trip_id) TABLESPACE pg_default;

create index IF not exists idx_trip_staff_staff_id on public.trip_staff using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_trip_staff_created_at on public.trip_staff using btree (created_at desc) TABLESPACE pg_default;

create table public.trips (
  id uuid not null default gen_random_uuid (),
  trip_name character varying(255) not null,
  destination character varying(255) not null,
  start_date date not null,
  end_date date not null,
  status character varying(50) null default 'active'::character varying,
  total_budget numeric(15, 2) null default 0,
  staff_id uuid null,
  check_in_time timestamp with time zone null,
  check_out_time timestamp with time zone null,
  check_in_notes text null,
  check_out_notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  activecustomerscount integer null default 0,
  currency character varying(10) null default 'HKD'::character varying,
  exchange_rate_peso numeric(10, 4) null default 1.0000,
  exchange_rate_hkd numeric(10, 4) null default 1.0000,
  exchange_rate_myr numeric(10, 4) null default 1.0000,
  constraint trips_pkey primary key (id),
  constraint trips_staff_id_fkey foreign KEY (staff_id) references staff (id),
  constraint trips_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'in-progress'::character varying,
            'completed'::character varying,
            'cancelled'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_trips_dates on public.trips using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_trips_active_customers_count on public.trips using btree (activecustomerscount) TABLESPACE pg_default;

create index IF not exists idx_trips_staff_id on public.trips using btree (staff_id) TABLESPACE pg_default;

create index IF not exists idx_trips_status on public.trips using btree (status) TABLESPACE pg_default;

create table public.users (
  id uuid not null default gen_random_uuid (),
  username character varying(100) not null,
  password character varying(255) not null,
  email character varying(255) null,
  role text null,
  agent_id uuid null,
  staff_id uuid null,
  status text null default 'active'::text,
  last_login timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_username_key unique (username),
  constraint users_agent_id_fkey foreign KEY (agent_id) references agents (id),
  constraint users_staff_id_fkey foreign KEY (staff_id) references staff (id),
  constraint users_role_check check (
    (
      role = any (
        array[
          'admin'::text,
          'agent'::text,
          'staff'::text,
          'boss'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;
