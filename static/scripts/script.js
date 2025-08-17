document.addEventListener('DOMContentLoaded', function() {
    
    const header = document.querySelector('header');

    if (user) {

        document.getElementsByClassName('auth-buttons')[0].innerHTML = `
        
            <a href='/profile' aria-label="Profile" class="topProfileLink">
                <img src='` + user.profilePicture + `' alt="User" class="userImageInsert">
            </a>

        `;

    } else {
        console.log("User doesn't exist");
    }
    
    function updateHeaderTheme() {
        const sections = document.querySelectorAll('section[data-header-theme]');
        const scrollPosition = window.scrollY + 80;
        
        let currentTheme = 'dark';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                currentTheme = section.dataset.headerTheme || 'dark';
            }
        });
        
        if (currentTheme === 'light') {
            header.classList.remove('header-dark');
            header.classList.add('header-light');
        } else {
            header.classList.remove('header-light');
            header.classList.add('header-dark');
        }
    }
    
    header.classList.add('header-dark');
    
    window.addEventListener('scroll', updateHeaderTheme);
    
    updateHeaderTheme();
});