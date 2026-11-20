-- 수집할 때 채널에 이미 달려 있던 답글을 EXTERNAL 로 (앞 마이그레이션에서 추가한 enum 값은 커밋 뒤에만 쓸 수 있어 따로 둔다)
-- 판별: 수집 코드는 리뷰와 답글을 한 번에 만들고(via API · 게시한 사람 없음), 사람이 API 채널에 단 답글은 게시한 사람이 있고
-- 자동 응대는 AUTO 다. 그래서 'API + 게시한 사람 없음 + 리뷰 저장 시각과 5초 안' 이면 수집 시점 답글로 본다.
-- 채널이 답글 시각을 주지 않았으므로 게시 시각은 비운다.
UPDATE "wj_review_reply" r
SET "post_method" = 'EXTERNAL', "posted_at" = NULL, "is_draft_edited" = NULL
FROM "wj_review" v
WHERE v."id" = r."review_id"
  AND r."post_method" = 'API'
  AND r."posted_by" IS NULL
  AND r."posted_at" IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (r."posted_at" - v."created_at"))) < 5;
