import re

with open('src/components/customer/Catalog.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'<div className="relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all group shadow-md min-w-0 h-full">',
    '<div className="relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all group shadow-md min-w-0 h-full min-h-[max-content] overflow-visible">',
    content
)
content = re.sub(
    r'<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 auto-rows-fr">',
    '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 items-stretch pb-10">',
    content
)
content = re.sub(
    r'<div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 bg-slate-900 pb-16 min-h-0">',
    '<div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 bg-slate-900 pb-24 min-h-0 pt-8">',
    content
)

with open('src/components/customer/Catalog.tsx', 'w') as f:
    f.write(content)
