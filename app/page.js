import "./landing.css";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingTestimonials from "@/components/landing/LandingTestimonials";
import {
  LandingHero, LandingStats, LandingHowItWorks, LandingTwoSides,
  LandingCategories, LandingCtaBand,
} from "@/components/landing/LandingSections";

// Homepage pra-login (route "/"), dikonversi dari digital.in-sam-fe (React +
// Vite + Tailwind). Gaya di app/landing.css (kelas lp-*, token brand Dashboard);
// client component: LandingHeader (menu mobile + toggle tema) dan
// LandingTestimonials ("Tampilkan lebih banyak").
export default function LandingPage() {
  return (
    <div className="lp">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingHowItWorks />
        <LandingTwoSides />
        <LandingCategories />
        <LandingTestimonials />
        <LandingCtaBand />
      </main>
      <LandingFooter />
    </div>
  );
}
