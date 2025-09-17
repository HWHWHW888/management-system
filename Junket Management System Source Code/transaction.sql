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