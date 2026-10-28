-- Chi chay khi volume db_data con trong (lan dau khoi tao).
-- Volume da co du lieu thi chay tay mot lan:
--   docker exec realestate-db psql -U <DB_USER> -d <DB_NAME> -c "CREATE EXTENSION IF NOT EXISTS vector;"
CREATE EXTENSION IF NOT EXISTS vector;
