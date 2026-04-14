-- 하나 더 (Hana More) - 초기 DB 스키마
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users (사용자 프로필)
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    nickname        TEXT,
    job_type        TEXT DEFAULT 'gig_worker',
    mydata_linked   BOOLEAN DEFAULT FALSE,
    character_dna   JSONB DEFAULT '{}',
    point_balance   INTEGER DEFAULT 0,
    streak_count    INTEGER DEFAULT 0,
    last_checkin_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. mission_logs (미션 완료 기록)
CREATE TABLE IF NOT EXISTS public.mission_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category         TEXT NOT NULL CHECK (category IN ('fA','fB','fC','fD')),
    mission_code     TEXT NOT NULL,
    mission_name     TEXT NOT NULL,
    raw_data         JSONB NOT NULL DEFAULT '{}',
    normalized_score FLOAT CHECK (normalized_score BETWEEN 0.0 AND 1.0),
    client_hash      TEXT,
    server_hash      TEXT,
    on_chain         BOOLEAN DEFAULT FALSE,
    tx_hash          TEXT,
    ai_verified      BOOLEAN,
    ai_check_reason  TEXT,
    completed_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_mission_daily
    ON public.mission_logs(user_id, mission_code, DATE(completed_at));

-- 3. point_ledger (포인트 이력)
CREATE TABLE IF NOT EXISTS public.point_ledger (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    mission_log_id  UUID REFERENCES public.mission_logs(id),
    amount          INTEGER NOT NULL,
    balance_after   INTEGER NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. user_streaks (연속 출석)
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    streak_count  INTEGER NOT NULL DEFAULT 1,
    streak_date   DATE NOT NULL,
    is_bonus_paid BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_user_streaks_date ON public.user_streaks(user_id, streak_date);

-- 5. blockchain_records (블록체인 공증)
CREATE TABLE IF NOT EXISTS public.blockchain_records (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_log_id UUID NOT NULL REFERENCES public.mission_logs(id),
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    keccak_hash    TEXT NOT NULL UNIQUE,
    tx_hash        TEXT NOT NULL,
    block_number   BIGINT DEFAULT 0,
    confirmed_at   TIMESTAMPTZ DEFAULT NOW(),
    verified       BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 6. godscores (갓생스코어 스냅샷 - Celery 배치 갱신)
CREATE TABLE IF NOT EXISTS public.godscores (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    score_date       DATE NOT NULL,
    fa_score         FLOAT, fb_score FLOAT, fc_score FLOAT, fd_score FLOAT,
    quarterly_score  FLOAT,
    cumulative_score FLOAT,
    final_score      FLOAT NOT NULL,
    grade            TEXT CHECK (grade IN ('새싹','성실','갓생','레전드')),
    shap_values      JSONB DEFAULT '{}',
    model_version    TEXT DEFAULT 'v1.0',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_godscores_user_date ON public.godscores(user_id, score_date);

-- 7. credit_scores (대안신용평가)
CREATE TABLE IF NOT EXISTS public.credit_scores (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cb_score       INTEGER,
    godscore       FLOAT NOT NULL,
    combined_score FLOAT NOT NULL,
    base_rate      FLOAT NOT NULL DEFAULT 4.25,
    discount_rate  FLOAT NOT NULL DEFAULT 0.0,
    final_rate     FLOAT NOT NULL,
    alpha          FLOAT DEFAULT 0.3,
    model_version  TEXT DEFAULT 'v1.0',
    evaluated_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.godscores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores    ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (본인 데이터만 접근)
CREATE POLICY "users_select_own"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"   ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "mission_logs_select" ON public.mission_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mission_logs_insert" ON public.mission_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "point_ledger_select" ON public.point_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_streaks_select" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "blockchain_select"   ON public.blockchain_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "godscores_select"    ON public.godscores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_select"       ON public.credit_scores FOR SELECT USING (auth.uid() = user_id);

-- 리더보드 뷰 (닉네임+점수만 공개)
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT g.user_id, u.nickname, g.final_score, g.grade, g.score_date,
       RANK() OVER (ORDER BY g.final_score DESC) AS rank
FROM public.godscores g JOIN public.users u ON g.user_id = u.id
WHERE g.score_date = CURRENT_DATE ORDER BY g.final_score DESC;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
