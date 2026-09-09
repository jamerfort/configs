syntax on

set paste
set hlsearch

set expandtab
set tabstop=2
set shiftwidth=2

function! StyleMarkdownHeaders()
    " 1. Clear default markdown header highlights so they don't conflict
    highlight clear markdownH1
    highlight clear markdownH2
    highlight clear markdownH3
    highlight clear markdownH4
    highlight clear markdownH5
    highlight clear markdownH6

    " 2. Define custom Background and Foreground colors for each level
    " guibg = Background Color | guifg = Text Color
    highlight MdH1 ctermbg=52  guibg=#5f0000 ctermfg=15 guifg=#ffffff cterm=bold gui=bold
    highlight MdH2 ctermbg=22  guibg=#005f00 ctermfg=15 guifg=#ffffff cterm=bold gui=bold
    highlight MdH3 ctermbg=25  guibg=#005faf ctermfg=15 guifg=#ffffff cterm=bold gui=bold
    highlight MdH4 ctermbg=239 guibg=#4e4e4e ctermfg=15 guifg=#ffffff
    highlight MdH5 ctermbg=237 guibg=#3a3a3a ctermfg=15 guifg=#ffffff
    highlight MdH6 ctermbg=235 guibg=#262626 ctermfg=15 guifg=#ffffff

    " 3. Map the syntax lines to our new highlight blocks
    syntax match MdH1 '^#\s.*$'
    syntax match MdH2 '^##\s.*$'
    syntax match MdH3 '^###\s.*$'
    syntax match MdH4 '^####\s.*$'
    syntax match MdH5 '^#####\s.*$'
    syntax match MdH6 '^######\s.*$'
endfunction

" Automatically apply these backgrounds when a Markdown file opens
augroup MarkdownHeaderColors
    autocmd!
    autocmd FileType markdown call StyleMarkdownHeaders()
augroup END
