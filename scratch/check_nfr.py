from automation.config import get_supabase

def check_nfr():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("*, eligibility_rules(*)").ilike("title", "%NFR%").execute()
    print("Found notifications for NFR:", len(res.data))
    for n in res.data:
        print("---")
        print("ID:", n.get("id"))
        print("Title:", n.get("title"))
        print("Apply Start Date:", n.get("apply_start_date"))
        print("Apply End Date:", n.get("apply_end_date"))
        print("Vacancy Count:", n.get("vacancy_count"))
        print("PDF URL:", n.get("pdf_url"))
        print("Rules Count:", len(n.get("eligibility_rules", [])))
        for r in n.get("eligibility_rules", []):
            print("  Post:", r.get("post_name"))
            print("  Education:", r.get("education_requirement"))
            print("  Additional:", r.get("additional_requirements"))
            print("  Confidence:", r.get("extraction_confidence"))

if __name__ == "__main__":
    check_nfr()
