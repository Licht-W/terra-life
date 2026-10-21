/* TL-M1-001 reference harness. Runs the vendored authors' C algorithms,
 * not the production TypeScript implementation. See README.md for provenance. */
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#define next splitmix64_next
#include "splitmix64.c"
#undef next
#include "xoshiro128starstar.c"

static void print_state(const uint32_t state[4]) {
    printf("[%" PRIu32, state[0]);
    for (int i = 1; i < 4; ++i) printf(",%" PRIu32, state[i]);
    printf("]");
}

static void print_sample(const uint32_t initial[4]) {
    memcpy(s, initial, sizeof s);
    printf("{\"initial\":");
    print_state(s);
    printf(",\"steps\":[");
    for (int i = 0; i < 12; ++i) {
        uint32_t output = next();
        if (i) printf(",");
        printf("{\"output\":%" PRIu32 ",\"state\":", output);
        print_state(s);
        printf("}");
    }
    printf("]}");
}

static void print_triplet(const uint32_t initial[4], const char *names[3]) {
    uint32_t states[3][4];
    memcpy(states[0], initial, sizeof s);
    memcpy(s, initial, sizeof s);
    jump();
    memcpy(states[1], s, sizeof s);
    jump();
    memcpy(states[2], s, sizeof s);
    printf("{");
    for (int i = 0; i < 3; ++i) {
        if (i) printf(",");
        printf("\"%s\":", names[i]);
        print_sample(states[i]);
    }
    printf("}");
}

int main(void) {
    const char *seeds[] = {"0000000000000000", "0000000000000001",
        "ffffffffffffffff", "8000000000000000", "0123456789abcdef", "deadbeefcafebabe"};
    const char *stream_names[] = {"life", "flavor", "birth"};
    const char *jump_names[] = {"base", "jump", "doubleJump"};
    const uint32_t cases[][4] = {
        {1, 2, 3, 4},
        {UINT32_MAX, UINT32_MAX, UINT32_MAX, UINT32_MAX},
        {0, 0, 0, UINT32_C(0x80000000)},
        {UINT32_C(0x80000000), UINT32_MAX, 0, 1}
    };
    printf("{\n\"seeds\":[\n");
    for (int i = 0; i < 6; ++i) {
        if (i) printf(",\n");
        if (sscanf(seeds[i], "%" SCNx64, &x) != 1) return 1;
        uint64_t first = splitmix64_next();
        uint64_t second = splitmix64_next();
        uint32_t initial[] = {(uint32_t)first, (uint32_t)(first >> 32),
            (uint32_t)second, (uint32_t)(second >> 32)};
        printf("{\"seed\":\"%s\",\"splitmix64\":[\"%016" PRIx64 "\",\"%016" PRIx64
            "\"],\"streams\":", seeds[i], first, second);
        print_triplet(initial, stream_names);
        printf("}");
    }
    printf("\n],\n\"states\":[\n");
    for (int i = 0; i < 4; ++i) {
        if (i) printf(",\n");
        print_triplet(cases[i], jump_names);
    }
    printf("\n]\n}\n");
    return ferror(stdout) ? 1 : 0;
}
