-- ==============================================================================
-- Wikimedia Commons Quarry SQL Queries for Contributor Metrics
-- Database: commonswiki_p (quarry.wmcloud.org)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- QUERY 1: Fast Batch Upload Counts & Storage Footprint for Top Indian Uploaders
-- Run time on commonswiki_p: ~1 to 2 seconds
-- Uses the indexed `img_actor_timestamp` index on `image` table.
-- ------------------------------------------------------------------------------
USE commonswiki_p;

SELECT 
    actor_name AS username, 
    COUNT(*) AS total_uploads,
    ROUND(SUM(img_size) / (1024 * 1024 * 1024), 2) AS total_size_gb,
    MIN(img_timestamp) AS first_upload_date,
    MAX(img_timestamp) AS latest_upload_date
FROM image
JOIN actor_image ON img_actor = actor_id
WHERE actor_name IN (
    'Gangulybiswarup', 'Netha Hussain', 'Pinakpani', 'Yercaud-elango',
    'Sumita Roy Dutta', 'Vengolis', 'Bodhisattwa', 'Sumitsurai',
    'Jkadavoor', 'Ranjithsiji', 'Suyash.dwivedi', 'Info-farmer',
    'Yakshitha', 'I.Mahesh', 'Thamizhpparithi Maari', 'Nizil Shah',
    'Jnanaranjan sahu', 'Tagooty', 'Subhrajyoti07', 'Kuldeepburjbhalaike',
    'Balajijagadesh', 'Dev Jadiya', 'Praveenp', 'Kiran Gopi', 'Gnoeee',
    'Pavanaja', 'Satdeep Gill', 'Dineshkannambadi', 'Atudu', 'Joydeep',
    'Snehrashmi', 'TAPAS KUMAR HALDER', 'Sourabh.biswas003', 'Kalyanvarma'
)
GROUP BY actor_name
ORDER BY total_uploads DESC;


-- ------------------------------------------------------------------------------
-- QUERY 2: Discovering All Prolific Contributors Across Major Indian Campaigns
-- Scans category links for national competitions and returns the top uploaders.
-- ------------------------------------------------------------------------------
USE commonswiki_p;

SELECT 
    actor_name AS username,
    COUNT(DISTINCT img_name) AS campaign_uploads,
    ROUND(SUM(img_size) / (1024 * 1024), 1) AS total_megabytes
FROM categorylinks
JOIN page ON cl_from = page_id AND page_namespace = 6
JOIN image ON page_title = img_name
JOIN actor_image ON img_actor = actor_id
WHERE cl_to IN (
    'Images_from_Wiki_Loves_Monuments_in_India',
    'Images_from_Wiki_Loves_Earth_in_India',
    'Images_from_Wiki_Loves_Folklore_in_India',
    'Images_of_India_by_user',
    'Quality_images_of_India_by_user'
)
GROUP BY actor_name
HAVING campaign_uploads >= 25
ORDER BY campaign_uploads DESC
LIMIT 200;


-- ------------------------------------------------------------------------------
-- QUERY 3: Find Contributors with 'India' or Regional Userboxes (Babel / Location)
-- Discovers Indian Wikimedians declared via User categories
-- ------------------------------------------------------------------------------
USE commonswiki_p;

SELECT 
    actor_name AS username,
    COUNT(*) AS total_uploads
FROM categorylinks
JOIN page ON cl_from = page_id AND page_namespace = 2 -- User namespace
JOIN actor_image ON page_title = actor_name
JOIN image ON img_actor = actor_id
WHERE cl_to IN (
    'Wikimedians_of_India_by_name',
    'Users_in_India',
    'Users_in_Tamil_Nadu',
    'Users_in_Kerala',
    'Users_in_West_Bengal',
    'Users_in_Karnataka',
    'Users_in_Gujarat'
)
GROUP BY actor_name
HAVING total_uploads >= 500
ORDER BY total_uploads DESC;
