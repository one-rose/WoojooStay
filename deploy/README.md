# 우주스테이 파일럿 배포 (AWS Lightsail)

서버 한 대에 **화면(Next.js) · API(NestJS) · DB(PostgreSQL) · HTTPS(Caddy)** 를 도커로 같이 올립니다.
실증 5개소 규모를 기준으로 했고, 업장이 늘면 DB만 Lightsail 관리형 DB로 옮기면 됩니다.

```
인터넷 ──443──▶ caddy ──▶ web:3000 (Next.js) ──▶ api:4000 (NestJS) ──▶ db:5432 (PostgreSQL)
                 HTTPS 자동         화면·서버 동작          바깥에 안 열림          바깥에 안 열림
```

- API와 DB는 바깥에 열지 않습니다. 브라우저는 화면 서버만 부르고, 화면 서버가 안쪽 네트워크로 API를 부릅니다.
- 영수증 사진(`uploads`)과 DB는 도커 볼륨에 저장되고, `backup.sh` 로 매일 백업합니다.
- 랜딩 페이지는 지금처럼 Vercel에 둬도 되고, 이 서버로 옮겨도 됩니다 (같은 이미지에 들어 있음).

## 1. 서버 만들기 (처음 한 번)

1. Lightsail → 인스턴스 생성
   - 리전 **서울(ap-northeast-2)**, 플랫폼 Linux, **Ubuntu 24.04 LTS**
   - 플랜: **메모리 2GB 이상** (화면 빌드에 메모리가 필요)
2. 네트워킹 → **고정 IP** 만들어 인스턴스에 붙이기 — 알리고 문자는 등록한 IP에서만 발송됩니다
3. 방화벽(IPv4): `HTTP 80` · `HTTPS 443` 추가. `SSH 22` 는 가능하면 내 IP만 허용
4. 도메인 DNS 에 **A 레코드** → 고정 IP (예: `app.woojoostay.com`)

## 2. 서버 준비 (SSH 접속 후 한 번)

```bash
# 도커
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# 스왑 2GB — 2GB 인스턴스에서 화면 빌드가 메모리 부족으로 멈추지 않게
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 코드
git clone https://github.com/one-rose/uzuStay.git && cd uzuStay/deploy   # 비공개 저장소면 GitHub 토큰 또는 배포 키 필요
cp .env.example .env && nano .env      # 아래 표 참고
```

| 값                                         | 넣는 법                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `DOMAIN`                                   | DNS 에 연결한 주소                                                                             |
| `DB_PASSWORD`                              | `openssl rand -base64 24`                                                                      |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 각각 `openssl rand -base64 48` (서로 다르게)                                                   |
| `INTERNAL_API_KEY`                         | `openssl rand -base64 48` — 화면 서버만 API를 부르게 하고, 요청 제한을 실제 사용자 IP 기준으로 |
| `TRIAL_DAYS`                               | 새 업장 무료 체험 일수 (8주 실증이면 56)                                                       |
| `ALLOW_FAKE_INTEGRATIONS`                  | 결제·문자 키 없이 시작하려면 `true` (아래 4번)                                                 |
| `CREDENTIALS_KEY`                          | `openssl rand -base64 32` — **한 번 정하면 바꾸지 않기** (바꾸면 저장된 채널 계정을 못 읽음)   |
| 외부 연동 키                               | 아래 4번. 비워 두면 개발용 가짜로 동작                                                         |

## 3. 실행

```bash
cd ~/uzuStay/deploy
docker compose up -d --build          # 처음엔 빌드 때문에 5~10분
docker compose ps                     # 4개 모두 running 인지
docker compose logs -f api            # 로그 보기 (Ctrl+C 로 빠져나옴)

# 운영자 계정 (비밀번호는 화면에 안 보이게 입력)
docker compose exec api node dist/admin-create.js --email admin@회사 --name 이름 --super
```

`https://도메인/app/login` 으로 접속합니다. 마이그레이션(테이블 생성·변경)은 API가 켜질 때 자동으로 적용됩니다.

**업데이트** (코드를 push 한 뒤)

```bash
cd ~/uzuStay && git pull && cd deploy && docker compose up -d --build
```

## 4. 외부 연동 켜기 (`.env` 에 키를 넣고 `docker compose up -d` 다시)

| 연동                        | 키                                                 | 준비할 것                                                                                                                  |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AI 답글 · 영수증 인식       | `ANTHROPIC_API_KEY`                                | Anthropic 콘솔에서 발급                                                                                                    |
| 사업자 상태조회             | `NTS_SERVICE_KEY`                                  | 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" 활용신청 → 일반 인증키(**Decoding**)                    |
| 문자 (인증번호·계약서 링크) | `ALIGO_API_KEY` `ALIGO_USER_ID` `SMS_SENDER`       | 알리고 가입 → 발신번호 등록(서류 심사) → **이 서버 고정 IP 등록**. 운영(`NODE_ENV=production`)이 아니면 테스트 모드로 보냄 |
| 정기결제                    | `TOSS_SECRET_KEY` (API) · `TOSS_CLIENT_KEY` (화면) | 토스페이먼츠 가입 → 자동결제(빌링) 계약. 먼저 `test_sk_…` / `test_ck_…` 로 카드 등록·결제 확인                             |

키가 없으면 각각 이렇게 동작합니다: 템플릿 답글 · 검증번호만 확인 · 문자는 로그에만 · 개발용 테스트 카드.
운영에서는 실수로 가짜 결제·문자로 돌지 않도록, 토스·알리고 키가 없으면 API가 시작하지 않아요. 키 없이 파일럿을 먼저 열 때만 `ALLOW_FAKE_INTEGRATIONS=true` 로 두세요 (인증번호 문자가 안 가므로 가입은 운영자가 도와야 해요).

## 5. 백업

```bash
crontab -e
# 매일 새벽 4시 30분, 14일치 보관 (~/backups)
30 4 * * * /home/ubuntu/uzuStay/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
```

복구: `docker compose exec -T db pg_restore -U uzustay -d uzustay --clean < ~/backups/db-날짜.dump`

Lightsail **자동 스냅샷**(인스턴스 → 스냅샷 → 자동 스냅샷 켜기)도 같이 켜 두면 서버 전체를 되돌릴 수 있습니다.
서버 디스크가 통째로 없어지는 경우에 대비해 `~/backups` 는 가끔 다른 곳(S3·내 PC)으로 옮겨 두세요.

## 자주 쓰는 명령

| 하려는 것   | 명령                                                  |
| ----------- | ----------------------------------------------------- |
| 상태        | `docker compose ps`                                   |
| 로그        | `docker compose logs -f api` (`web` · `caddy` · `db`) |
| 다시 시작   | `docker compose restart api`                          |
| DB 접속     | `docker compose exec db psql -U uzustay`              |
| 디스크 정리 | `docker system prune -f` (안 쓰는 옛 이미지 삭제)     |
