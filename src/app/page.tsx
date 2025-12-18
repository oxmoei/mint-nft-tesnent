import Header from "@/components/Header";
import NFTCheckout from "@/components/NFTCheckout";

export default function Home() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <NFTCheckout />
      </main>
    </>
  );
}
