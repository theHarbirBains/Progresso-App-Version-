-- Reclassifies the built-in exercises that are unambiguously unilateral by
-- their own name/mechanics -- an explicit, minimal reclassification, not a
-- blanket guess across the library. Every other built-in exercise (e.g.
-- Dumbbell Lateral Raise, Leg Extension, Cable Kickback, Seated/Lying Leg
-- Curl) has a real single-limb variant in common use but is *standardly*
-- performed bilaterally and is not renamed here -- see the implementation
-- report for the full list of exercises considered and left as bilateral
-- pending an explicit product decision.
update public.exercises
set movement_type = 'unilateral', logging_style = 'single_side'
where created_by is null and name = 'Single-Arm Dumbbell Row';

update public.exercises
set movement_type = 'unilateral', logging_style = 'alternating'
where created_by is null and name = 'Bulgarian Split Squat';
