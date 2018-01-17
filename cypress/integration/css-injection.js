describe('Reloading a CSS file', function() {
    beforeEach(function() {
        cy.visit(Cypress.env('BS_URL'));
    });
    it('should reload single <link>', function() {
        cy.exec('touch test/fixtures/**/style.css');
        cy.wait(500);
        cy.get('[id="css-style"]').should($link => {
            const url = new URL($link.attr('href'));
            expect(url.search).to.contain('?browsersync=');
        });
    });
    it('should reload 2 css files', function() {
        cy.exec('touch test/fixtures/**/*.css');
        cy.wait(500);
        cy.get('link').should($links => {
            $links.each((i, elem) => {
                const url = new URL(elem.href);
                expect(url.search).to.contain('?browsersync=');
            });
        });
    });
});