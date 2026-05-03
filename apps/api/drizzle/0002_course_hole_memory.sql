CREATE TABLE "course_hole_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"key_learnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"num_visits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "round_scores" ADD COLUMN "key_learnings" jsonb;
--> statement-breakpoint
ALTER TABLE "course_hole_memory" ADD CONSTRAINT "course_hole_memory_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_hole_memory" ADD CONSTRAINT "course_hole_memory_profile_id_player_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_course_hole_memory" ON "course_hole_memory" USING btree ("profile_id","course_id","hole_number");
