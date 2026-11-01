-- Free-text stations become one of OKKO, UKRNAFTA, UPG, WOG, OTHER (null stays null).
UPDATE "energy_entry" SET "station" = CASE
  WHEN "station" IS NULL OR btrim("station") = '' THEN NULL
  WHEN lower(btrim("station")) = 'okko' THEN 'OKKO'
  WHEN lower(btrim("station")) IN ('ukrnafta', 'укрнафта') THEN 'UKRNAFTA'
  WHEN lower(btrim("station")) = 'upg' THEN 'UPG'
  WHEN lower(btrim("station")) = 'wog' THEN 'WOG'
  ELSE 'OTHER'
END;
