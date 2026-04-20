SELECT c.name, COUNT(t.topic_id) as topic_count
FROM courses c
LEFT JOIN topics t ON t.course_id = c.course_id
WHERE c.user_id = (SELECT user_id FROM users LIMIT 1)
GROUP BY c.name;
