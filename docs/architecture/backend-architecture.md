# Backend Architecture (intended)

- config/: env, database (Sequelize), logger
- routes/ -> middlewares (auth, role, validation) -> controllers (thin) -> services (logic) -> models
- utils/: apiResponse, errors, constants, pagination
- jobs/: analysis.job, pattern.job (BullMQ later)
- Rules: never call AI from routes; never overwrite original report text.
