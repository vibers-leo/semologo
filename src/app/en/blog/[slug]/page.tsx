import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BLOG_POSTS } from "@/lib/blog";
import { getStory } from "@/lib/story-cms";
import StoryVideo from "@/components/StoryVideo";
export const dynamic="force-dynamic";
export function generateStaticParams() { return BLOG_POSTS.map(post => ({ slug: post.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const post = await getStory((await params).slug); return post ? { title: `${post.title} | SemoLogo`, description: post.description } : {}; }
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) { const post = await getStory((await params).slug); if (!post) notFound(); return <><Header/><main className="content-page py-12 pb-28"><p className="text-sm text-indigo-600">{post.category} · {post.date}</p><h1 className="mt-3 text-3xl font-black leading-tight">{post.title}</h1><p className="mt-4 text-lg leading-8 text-gray-600">{post.description}</p>{post.coverImage&&<img src={post.coverImage} alt="" className="mt-8 max-h-96 w-full rounded-2xl object-contain"/>}{post.video&&<div className="mt-8 max-w-sm"><StoryVideo url={post.video.url} poster={post.video.poster} title={post.title}/></div>}<article className="mt-10 space-y-9">{post.sections.map((section,index) => <section key={index}>{section.heading&&<h2 className="text-xl font-bold">{section.heading}</h2>}{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 leading-8 text-gray-700">{paragraph}</p>)}</section>)}</article></main><Footer/></>; }
