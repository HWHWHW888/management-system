-- 创建简化版客户照片关联表
CREATE TABLE public.customer_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  trip_id uuid NOT NULL REFERENCES trips(id),
  photo_type TEXT NOT NULL CHECK (photo_type IN ('transaction', 'rolling')),
  photo jsonb NOT NULL,         -- 存储照片为JSON格式，包含数据和元信息
  uploaded_by uuid NOT NULL REFERENCES staff(id),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  transaction_date DATE,        -- 交易或滚码的实际日期
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);

-- 创建索引以提高查询性能
CREATE INDEX idx_customer_photos_customer_id ON public.customer_photos USING btree (customer_id);
CREATE INDEX idx_customer_photos_trip_id ON public.customer_photos USING btree (trip_id);
CREATE INDEX idx_customer_photos_photo_type ON public.customer_photos USING btree (photo_type);
CREATE INDEX idx_customer_photos_uploaded_by ON public.customer_photos USING btree (uploaded_by);
CREATE INDEX idx_customer_photos_status ON public.customer_photos USING btree (status);
CREATE INDEX idx_customer_photos_transaction_date ON public.customer_photos USING btree (transaction_date);

-- 创建JSON索引以优化照片查询
CREATE INDEX idx_customer_photos_photo_filename ON public.customer_photos USING gin ((photo -> 'filename'));
CREATE INDEX idx_customer_photos_photo_type_json ON public.customer_photos USING gin ((photo -> 'type'));
CREATE INDEX idx_customer_photos_photo_uploaded_at ON public.customer_photos USING gin ((photo -> 'uploaded_at'));

-- 创建复合索引以优化常见查询场景
CREATE INDEX idx_customer_photos_trip_customer ON public.customer_photos USING btree (trip_id, customer_id);
CREATE INDEX idx_customer_photos_trip_customer_type ON public.customer_photos USING btree (trip_id, customer_id, photo_type);

-- 添加注释
COMMENT ON TABLE public.customer_photos IS '存储客户交易和滚码照片的关联信息，由staff上传，admin审核';
COMMENT ON COLUMN public.customer_photos.photo_type IS '照片类型：transaction（交易）或rolling（滚码）';
COMMENT ON COLUMN public.customer_photos.photo IS '照片JSON数据，包含照片内容和元数据';
COMMENT ON COLUMN public.customer_photos.transaction_date IS '交易或滚码的实际日期，由staff在上传时提供';
COMMENT ON COLUMN public.customer_photos.status IS '照片状态：pending（待审核）、approved（已批准）或rejected（已拒绝）';
