import { defineDeck } from 'blackboard-deck';
import { forwardSlides } from './forward.js';
import { backwardSlides } from './backward.js';
import { landscapeSlide } from './landscape.js';
import { attentionSlides } from './attention.js';
import { cover, contextSlide, exerciseSlide, ending } from './bookends.js';

// Forward and backward computation: https://d2l.ai/chapter_multilayer-perceptrons/backprop.html
// Scaled dot-product attention: https://arxiv.org/abs/1706.03762
export const title = 'A neural network, by hand';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

const chapters = { 'Forward pass': '前向传播', 'Backward pass': '反向传播', 'Self-attention': '自注意力', 'Check your work': '练习与回顾' };
const slides = [cover, ...forwardSlides, ...backwardSlides, landscapeSlide, contextSlide, ...attentionSlides, exerciseSlide, ending];
const titlesZh = {
  'loss-slope':'哪个方向是下坡？', 'reverse-chain':'把斜率沿途传回', 'parameter-gradients':'哪个权重影响更大？', 'descent-step':'更新所有参数',
};
export const { stops, createScene } = defineDeck(slides.map(slide => ({
  ...slide, chapterZh: chapters[slide.chapter], titleZh: slide.titleZh || titlesZh[slide.id],
})));
