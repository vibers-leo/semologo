BEGIN;
CREATE OR REPLACE FUNCTION semologo.archive_logo_asset_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a jsonb; sig text; inherited_manifest jsonb;
BEGIN
 a:=semologo.logo_asset_snapshot(NEW.payload);sig:=md5(a::text);
 IF TG_OP='UPDATE' AND a=semologo.logo_asset_snapshot(OLD.payload) THEN RETURN NEW; END IF;
 -- Preserve verified files/variants before retiring the current asset version.
 SELECT asset_manifest INTO inherited_manifest FROM semologo.logo_versions
 WHERE brand_id=NEW.id AND is_current FOR UPDATE;
 UPDATE semologo.logo_versions SET is_current=false WHERE brand_id=NEW.id AND is_current;
 INSERT INTO semologo.logo_versions(id,brand_id,asset_signature,assets,asset_manifest,is_current,source_url,label)
 VALUES(NEW.id||'-'||sig,NEW.id,sig,a,inherited_manifest,true,NEW.payload->>'official_source_page','수집 로고 · 도입 연도 미확인')
 ON CONFLICT(brand_id,asset_signature) DO UPDATE SET is_current=true,
 asset_manifest=coalesce(logo_versions.asset_manifest,EXCLUDED.asset_manifest);
 RETURN NEW;
END $$;
COMMIT;
