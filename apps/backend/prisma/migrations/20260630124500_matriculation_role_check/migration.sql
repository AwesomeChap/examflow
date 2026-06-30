-- matriculationNumber is only allowed for students
ALTER TABLE "User"
ADD CONSTRAINT "User_matriculationNumber_role_check"
CHECK (
  "role" = 'student'::"UserRole" OR "matriculationNumber" IS NULL
);
