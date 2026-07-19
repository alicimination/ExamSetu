import sys
from automation.config import get_supabase

sys.stdout.reconfigure(encoding="utf-8")

def main():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("id, title, exam_body, vacancy_count, apply_start_date, apply_end_date").execute()
    print("Total notifications:", len(res.data))
    missing_dates = [n for n in res.data if not n.get("apply_end_date")]
    print(f"Notifications missing apply_end_date: {len(missing_dates)}")
    for n in missing_dates[:15]:
        print(f"- [{n['exam_body']}] {n['title']} (Vacancies: {n['vacancy_count']})")

if __name__ == "__main__":
    main()
