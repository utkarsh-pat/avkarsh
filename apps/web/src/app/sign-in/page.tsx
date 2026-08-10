import { SignInCard } from "./sign-in-card";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return <SignInCard error={error} />;
}
