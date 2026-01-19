
import re
import os

file_path = r'c:\Users\harvinder Singh\Downloads\socialmediabackendfinalss\api-server\src\routes\users.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getDb() with getDatabase()
content = content.replace('const db = await getDb()', 'const db = await getDatabase()')

# Replace MongoClient connection block
# Pattern: const client = await MongoClient.connect(MONGODB_URI)
#          const db = client.db()
# We need to handle variable whitespace
pattern_mongo = re.compile(r'const\s+client\s*=\s*await\s+MongoClient\.connect\(MONGODB_URI\)\s*\n\s*const\s+db\s*=\s*client\.db\(\)', re.MULTILINE)
content = pattern_mongo.sub('const db = await getDatabase()', content)

# Remove client.close()
# Pattern: await client.close()
pattern_close = re.compile(r'\s*await\s+client\.close\(\)\s*', re.MULTILINE)
content = pattern_close.sub('\n', content)

# Remove any remaining MongoClient usages if they were split differently?
# Let's check if there are any other client.db() calls
# Or just replace the imports if we want to be thorough, but removing usage is enough.

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated users.ts")
