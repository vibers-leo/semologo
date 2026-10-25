import test from 'node:test';
import assert from 'node:assert/strict';
import {storyRailMode} from '../src/lib/story-rail-policy.mjs';
test('logo wall routes never mount a video rail',()=>{for(const p of ['/logo-walls','/logo-walls/','/logo-walls/shared-123/','/en/logo-walls/'])assert.equal(storyRailMode(p),'off');});
test('home starts collapsed in either locale',()=>{for(const p of ['/','/en','/en/'])assert.equal(storyRailMode(p),'collapsed');});
test('public content starts expanded; work and authentication screens are excluded',()=>{for(const p of ['/blog/','/brand/msit-go/','/en/faq/','/advertise/'])assert.equal(storyRailMode(p),'expanded');for(const p of ['/admin/stories/','/login/','/en/login/','/api/stories/'])assert.equal(storyRailMode(p),'off');});
