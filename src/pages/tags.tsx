import Head from "next/head";
import Navigation from "@/components/Navigation";

export default function Tags() {
  return (
    <>
      <Head>
        <title>DishDiary - Tags</title>
      </Head>
      <main className="container">
        <Navigation currentPage="tags" />
        <h1>Tags</h1>
        <p className="subtitle">Manage your meal tags</p>

        <div className="form">
          <p>Tag management functionality coming soon!</p>
          <p>
            This page will allow you to view, edit, and organize all the tags
            you've created for your meals.
          </p>
        </div>

        <div className="version-indicator">
          v0.2.9
        </div>
      </main>
    </>
  );
}