import { Nav } from "./components/landing/Nav";
import { Hero } from "./components/landing/Hero";
import { Problem } from "./components/landing/Problem";
import { HowItWorks } from "./components/landing/HowItWorks";
import { Defensible } from "./components/landing/Defensible";
import { CodeSnippet } from "./components/landing/CodeSnippet";
import { FinalCta } from "./components/landing/FinalCta";
import { Footer } from "./components/landing/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Defensible />
        <CodeSnippet />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
