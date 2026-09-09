import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog";
export function generateStaticParams() { return BLOG_POSTS.map(post => ({ slug: post.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const post = getBlogPost((await params).slug); return post ? { title: `${post.title} | 세모로고`, description: post.description } : {}; }
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) { const post = getBlogPost((await params).slug); if (!post) notFound(); return <><Header/><main className="mx-auto max-w-3xl px-5 py-12 pb-28"><p className="text-sm text-indigo-600">{post.category} · {post.date}</p><h1 className="mt-3 text-3xl font-black leading-tight">{post.title}</h1><p className="mt-4 text-lg leading-8 text-gray-600">{post.description}</p><article className="mt-10 space-y-9">{post.sections.map(section => <section key={section.heading}><h2 className="text-xl font-bold">{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 leading-8 text-gray-700">{paragraph}</p>)}</section>)}</article></main><Footer/></>; }
