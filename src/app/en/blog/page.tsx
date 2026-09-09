import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BLOG_POSTS } from "@/lib/blog";
export const metadata = { title: "Logo stories and guides | SemoLogo", description: "Practical guides for finding, downloading and using SVG and PNG brand logos." };
export default function BlogPage() { return <><Header/><main className="mx-auto max-w-4xl px-5 py-12 pb-28"><p className="text-sm font-semibold text-indigo-600">SemoLogo Blog</p><h1 className="mt-3 text-3xl font-black">Logo stories and practical guides</h1><p className="mt-3 text-gray-500">Tips for searching brand logos and using SVG and PNG files in real projects.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{BLOG_POSTS.map(post => <article key={post.slug} className="rounded-2xl border p-5"><p className="text-xs text-gray-500">{post.category} · {post.date}</p><h2 className="mt-3 text-lg font-bold leading-7">{post.title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{post.description}</p><Link className="mt-5 inline-block text-sm font-semibold underline" href={`/en/blog/${post.slug}/`}>Read article →</Link></article>)}</div></main><Footer/></>; }
