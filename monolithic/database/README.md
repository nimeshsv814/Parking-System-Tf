# Database Tier

MongoDB runs from the `database` service in `../docker-compose.yml`.

The `init-mongo.js` script creates the `smartparking` database collections and indexes on first container startup. The backend also seeds demo users and parking slots after it connects.
