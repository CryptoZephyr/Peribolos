import { Nav } from "./components/landing/Nav";
import { Hero } from "./components/landing/Hero";
import { Ecosystem } from "./components/landing/Ecosystem";
import { ActivationPath } from "./components/landing/ActivationPath";
import { ArcSignals } from "./components/landing/ArcSignals";
import { ProductPreview } from "./components/landing/ProductPreview";
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
      <main id="main-content">
        <Hero />
        <Ecosystem />
        <ActivationPath />
        <ArcSignals />
        <ProductPreview />
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
